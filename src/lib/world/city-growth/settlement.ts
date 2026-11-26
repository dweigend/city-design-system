import { required } from '../../core/invariant';
import { encodeKey } from '../../core/ref';
import type { Random } from '../../core/random';
import { createBuilding, type Construction } from './building';
import type { GrowthCarrier, HoldingCandidate } from './carrier';
import { createWing } from './construction';
import { createStock } from './history';
import { readEra } from './recipe';
import { selectStockChange } from './stock';
import type { LaneAccess } from './lanes';
import type { CityGrowthEvent, CityGrowthRecipe, CityStockChange, HoldingSettled } from './types';

function reachableSizes(carrier: GrowthCarrier) {
	const sizes = new Map<string, number>();
	for (const first of carrier.holdingsByLane.keys()) {
		if (sizes.has(first)) continue;
		const reached = new Set([first]);
		let count = 0;
		for (const laneId of reached) {
			count += carrier.holdingsByLane.get(laneId)?.length ?? 0;
			for (const access of carrier.accessByLane.get(laneId) ?? []) reached.add(access.laneId);
		}
		for (const id of reached) sizes.set(id, count);
	}
	return sizes;
}

function readBest(
	proposals: Iterable<LaneAccess>,
	carrier: GrowthCarrier,
	recipe: CityGrowthRecipe,
	random: Random,
	scoreLane: (access: LaneAccess) => number,
	settledIds: ReadonlySet<string>
) {
	let best: { candidate: HoldingCandidate; access: LaneAccess; score: number } | undefined;
	for (const access of proposals) {
		const laneScore = scoreLane(access);
		for (const candidate of carrier.holdingsByLane.get(access.laneId) ?? []) {
			const { id } = candidate.parcel;
			if (settledIds.has(id)) continue;
			const score =
				candidate.siteScore + laneScore + recipe.seedVariationWeight * random.derive(id).number();
			if (!best || score > best.score || (score === best.score && id < best.candidate.parcel.id))
				best = { candidate, access, score };
		}
	}
	return best;
}

function createFrontier(carrier: GrowthCarrier) {
	const settledIds = new Set<string>();
	const lanes = new Set<string>();
	const access = new Map<string, LaneAccess>();
	return {
		settledIds,
		lanes,
		access,
		add(event: HoldingSettled) {
			settledIds.add(event.holding.id);
			for (const { id } of event.lanes) {
				lanes.add(id);
				for (const proposal of carrier.accessByLane.get(id) ?? []) {
					const previous = access.get(proposal.laneId);
					if (!previous || proposal.lengthM < previous.lengthM)
						access.set(proposal.laneId, proposal);
				}
			}
		}
	};
}

function createEvent(
	carrier: GrowthCarrier,
	recipe: CityGrowthRecipe,
	{ candidate, access }: NonNullable<ReturnType<typeof readBest>>,
	year: number,
	sequence: number,
	reason: HoldingSettled['reason'],
	random: Random
): HoldingSettled {
	const { parcel, portal, memberCellIds, ground, burgage } = candidate;
	const holding = Object.freeze({
		...parcel,
		portal,
		memberCellIds,
		builtYear: year,
		protected: recipe.protectedHoldingIds?.includes(parcel.id) ?? false,
		...(burgage && { courtAccess: burgage.courtAccess })
	});
	const buildingId = encodeKey(['building', parcel.id]);
	const construction: Construction = {
		builtYear: year,
		era: readEra(recipe, year),
		seed: random.derive(buildingId).seed,
		use: 'housing'
	};
	const parts =
		burgage &&
		createWing(
			buildingId,
			burgage,
			burgage.frontId,
			carrier.planes,
			recipe.initialStoreys,
			construction
		);
	return Object.freeze({
		kind: 'holding-settled',
		year,
		sequence,
		reason,
		holding,
		lanes: Object.freeze(access.path.map((lane) => Object.freeze({ ...lane, builtYear: year }))),
		building: createBuilding(
			buildingId,
			holding.id,
			ground,
			recipe.initialStoreys,
			carrier.planes,
			construction,
			parts
		)
	});
}

export function createSettlement(
	carrier: GrowthCarrier,
	recipe: CityGrowthRecipe,
	random: Random,
	events: CityGrowthEvent[]
) {
	const frontier = createFrontier(carrier);
	const stock = createStock();
	function add(event: CityGrowthEvent) {
		if (event.kind === 'holding-settled') frontier.add(event);
		stock.add(event);
	}
	for (const event of events) add(event);
	function commit(event: CityGrowthEvent) {
		events.push(event);
		add(event);
	}
	function settle(year: number, sequence: number, reason: HoldingSettled['reason']) {
		const available = function* () {
			for (const access of frontier.access.values()) {
				let lastOpen = -1;
				for (let index = access.path.length - 1; index >= 0; index--) {
					if (frontier.lanes.has(access.path[index].id)) {
						lastOpen = index;
						break;
					}
				}
				const path = lastOpen === -1 ? access.path : access.path.slice(lastOpen + 1);
				const lengthM = path.reduce((length, lane) => length + lane.lengthM, 0);
				yield { ...access, path, lengthM };
			}
		};
		const site = readBest(
			available(),
			carrier,
			recipe,
			random.derive(JSON.stringify([reason, year, sequence])),
			({ lengthM }) => recipe.laneAccessWeight / (1 + lengthM / recipe.accessDistanceScaleM),
			frontier.settledIds
		);
		if (!site) return false;
		commit(createEvent(carrier, recipe, site, year, sequence, reason, random));
		return true;
	}
	return {
		found() {
			const sizes = reachableSizes(carrier);
			const possible = [...sizes].flatMap(([laneId, size]) => {
				if (size < recipe.minimumFoundingHoldings) return [];
				const lane = required(carrier.lanesById.get(laneId), 'founding lane');
				return [{ laneId, path: [lane], lengthM: lane.lengthM }];
			});
			const founder = readBest(
				possible,
				carrier,
				recipe,
				random.derive('founder'),
				({ laneId }) => {
					const count = (carrier.accessByLane.get(laneId) ?? []).reduce(
						(sum, { laneId: nearby }) => sum + (carrier.holdingsByLane.get(nearby)?.length ?? 0),
						0
					);
					return (recipe.neighborWeight * count) / (count + recipe.minimumFoundingHoldings);
				},
				frontier.settledIds
			);
			if (!founder) return;
			const firstSequence = /* Exact arithmetic: sequence starts at zero each year. */ 0;
			commit(
				createEvent(carrier, recipe, founder, recipe.startYear, firstSequence, 'founding', random)
			);
			for (let sequence = 1; sequence < recipe.minimumFoundingHoldings; sequence++) {
				if (!settle(recipe.startYear, sequence, 'founding'))
					throw Error('Missing reachable founding holding');
			}
		},
		expand(year: number) {
			const capacity = Math.min(
				recipe.holdingsPerStep,
				recipe.maximumActiveHoldings - stock.holdings.size
			);
			let sequence = 0;
			while (sequence < capacity && settle(year, sequence, 'expansion')) sequence++;
			return sequence;
		},
		change(change: CityStockChange, sequence: number, changeIndex: number) {
			const { year, kind } = change;
			const event = selectStockChange(
				carrier,
				stock,
				recipe,
				change,
				{ year, sequence },
				random.derive(encodeKey(['stock', year, changeIndex, kind]))
			);
			if (event) commit(event);
			return event !== undefined;
		}
	};
}
