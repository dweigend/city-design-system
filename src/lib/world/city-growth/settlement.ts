import { required } from '../../core/invariant';
import type { Random } from '../../core/random';
import { createBuilding } from './building';
import type { GrowthCarrier, HoldingCandidate } from './carrier';
import type { LaneAccess } from './lanes';
import type { CityGrowthEvent, CityGrowthRecipe, HoldingSettled } from './types';

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
	activeHoldings: ReadonlySet<string>
) {
	let best: { candidate: HoldingCandidate; access: LaneAccess; score: number } | undefined;
	for (const access of proposals) {
		const laneScore = scoreLane(access);
		for (const candidate of carrier.holdingsByLane.get(access.laneId) ?? []) {
			const { id } = candidate.parcel;
			if (activeHoldings.has(id)) continue;
			const score =
				candidate.siteScore + laneScore + recipe.seedVariationWeight * random.derive(id).number();
			if (!best || score > best.score || (score === best.score && id < best.candidate.parcel.id))
				best = { candidate, access, score };
		}
	}
	return best;
}

function createFrontier(carrier: GrowthCarrier) {
	const holdings = new Set<string>();
	const lanes = new Set<string>();
	const access = new Map<string, LaneAccess>();
	return {
		holdings,
		lanes,
		access,
		add(event: CityGrowthEvent) {
			switch (event.kind) {
				case 'holding-settled':
					holdings.add(event.holding.id);
					for (const { id } of event.lanes) {
						lanes.add(id);
						for (const proposal of carrier.accessByLane.get(id) ?? []) {
							const previous = access.get(proposal.laneId);
							if (!previous || proposal.lengthM < previous.lengthM)
								access.set(proposal.laneId, proposal);
						}
					}
					return;
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
	reason: HoldingSettled['reason']
): HoldingSettled {
	const { parcel, portal, memberCellIds, ground } = candidate;
	const holding = Object.freeze({ ...parcel, portal, memberCellIds, builtYear: year });
	return Object.freeze({
		kind: 'holding-settled',
		year,
		sequence,
		reason,
		holding,
		lanes: Object.freeze(access.path.map((lane) => Object.freeze({ ...lane, builtYear: year }))),
		building: createBuilding(holding.id, year, ground, recipe.initialStoreys, carrier.planes)
	});
}

export function createSettlement(
	carrier: GrowthCarrier,
	recipe: CityGrowthRecipe,
	random: Random,
	events: CityGrowthEvent[]
) {
	const frontier = createFrontier(carrier);
	for (const event of events) frontier.add(event);
	function commit(event: CityGrowthEvent) {
		events.push(event);
		frontier.add(event);
	}
	function settle(year: number, sequence: number, reason: HoldingSettled['reason']) {
		const available = function* () {
			for (const access of frontier.access.values()) {
				const path = access.path.filter(({ id }) => !frontier.lanes.has(id));
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
			frontier.holdings
		);
		if (!site) return false;
		commit(createEvent(carrier, recipe, site, year, sequence, reason));
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
				frontier.holdings
			);
			if (!founder) return;
			const firstSequence = /* Exact arithmetic: sequence starts at zero each year. */ 0;
			commit(createEvent(carrier, recipe, founder, recipe.startYear, firstSequence, 'founding'));
			for (let sequence = 1; sequence < recipe.minimumFoundingHoldings; sequence++) {
				if (!settle(recipe.startYear, sequence, 'founding'))
					throw Error('Missing reachable founding holding');
			}
		},
		expand(year: number) {
			const capacity = Math.min(
				recipe.holdingsPerStep,
				recipe.maximumActiveHoldings - frontier.holdings.size
			);
			for (let sequence = 0; sequence < capacity; sequence++) {
				if (!settle(year, sequence, 'expansion')) return false;
			}
			return capacity > 0 && frontier.holdings.size < recipe.maximumActiveHoldings;
		}
	};
}
