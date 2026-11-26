import { required } from '../../core/invariant';
import { encodeKey } from '../../core/ref';
import type { Random } from '../../core/random';
import { createBuilding, type Construction } from './building';
import type { GrowthCarrier, HoldingCandidate } from './carrier';
import { createWing } from './construction';
import { createStock } from './history';
import { developmentDefaults, readEra } from './recipe';
import { selectStockChange } from './stock';
import { limitInitialStoreys } from './skyline';
import { createPublicWorks } from './public-works';
import { readPendingAccess, type LaneAccess } from './lanes';
import type {
	CityGrowthBuilding,
	CityGrowthEvent,
	CityGrowthRecipe,
	CityStockChange,
	HoldingSettled
} from './types';

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
	isAvailable: (id: string) => boolean
) {
	let best: { candidate: HoldingCandidate; access: LaneAccess; score: number } | undefined;
	for (const access of proposals) {
		const laneScore = scoreLane(access);
		for (const candidate of carrier.holdingsByLane.get(access.laneId) ?? []) {
			const { id } = candidate.parcel;
			if (!isAvailable(id)) continue;
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
		add(event: CityGrowthEvent) {
			if ('holding' in event) settledIds.add(event.holding.id);
			if (!('lanes' in event)) return;
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
	random: Random,
	storeys: number,
	center?: { id: string; use: HoldingSettled['building']['use'] }
): HoldingSettled {
	const { parcel, portal, memberCellIds, ground } = candidate;
	const burgage = carrier.readBurgage(parcel.id);
	const holding = Object.freeze({
		...parcel,
		portal,
		memberCellIds,
		builtYear: year,
		protected: recipe.protectedHoldingIds?.includes(parcel.id) ?? false,
		...(center && { centerId: center.id }),
		...(burgage && { courtAccess: burgage.courtAccess })
	});
	const buildingId = encodeKey(['building', parcel.id]);
	const construction: Construction = {
		builtYear: year,
		era: readEra(recipe, year),
		seed: random.derive(buildingId).seed,
		use: center?.use ?? 'housing'
	};
	const parts =
		burgage &&
		createWing(buildingId, burgage, burgage.frontId, carrier.planes, storeys, construction);
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
			storeys,
			carrier.planes,
			construction,
			parts?.length ? parts : undefined
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
	for (const event of events) {
		frontier.add(event);
		stock.add(event);
	}
	const works =
		recipe.development && createPublicWorks(carrier, recipe, frontier, random, events, commit);
	function commit(event: CityGrowthEvent) {
		events.push(event);
		frontier.add(event);
		stock.add(event);
		works?.add(event);
	}
	function build(
		site: NonNullable<ReturnType<typeof readBest>>,
		year: number,
		sequence: number,
		reason: HoldingSettled['reason'],
		centerId?: string
	) {
		const { parcel, memberCellIds } = site.candidate;
		const storeys = recipe.development
			? limitInitialStoreys(carrier, stock, { id: parcel.id, memberCellIds }, recipe.initialStoreys)
			: recipe.initialStoreys;
		const programs = new Set<CityGrowthBuilding['use']>();
		if (centerId) {
			for (const [id, { use }] of stock.buildings)
				if (stock.holdings.get(id)?.centerId === centerId) programs.add(use);
		}
		let use: CityGrowthBuilding['use'] = 'housing';
		if (!programs.has('workshop')) use = 'workshop';
		else if (!programs.has('public')) use = 'public';
		const center = centerId ? { id: centerId, use } : undefined;
		commit(createEvent(carrier, recipe, site, year, sequence, reason, random, storeys, center));
	}
	function settle(
		year: number,
		sequence: number,
		reason: HoldingSettled['reason'],
		ordinal = sequence,
		catchment?: ReadonlySet<string>,
		centerId?: string
	) {
		const site = readBest(
			Array.from(frontier.access.values(), (access) => readPendingAccess(access, frontier.lanes)),
			carrier,
			recipe,
			random.derive(JSON.stringify([reason, year, ordinal])),
			({ lengthM }) => recipe.laneAccessWeight / (1 + lengthM / recipe.accessDistanceScaleM),
			(id) => !frontier.settledIds.has(id) && (!catchment || catchment.has(id))
		);
		if (!site) return false;
		const center =
			centerId ??
			[...(works?.centers ?? [])].find(([, ids]) => ids.has(site.candidate.parcel.id))?.[0];
		build(site, year, sequence, reason, center);
		return true;
	}
	function openPublicWorks(year: number) {
		const schedule = recipe.development;
		const available = recipe.maximumActiveHoldings - stock.holdings.size;
		const first = /* Exact arithmetic: the yearly sequence begins at zero. */ 0;
		if (!works || !schedule || recipe.holdingsPerStep === 0 || available === 0) return first;
		let sequence = first;
		if (year >= (schedule.crossingFromYear ?? developmentDefaults.crossingFromYear))
			sequence = works.bridge(year, sequence, available > 1);
		if (year >= (schedule.railFromYear ?? developmentDefaults.railFromYear))
			sequence = works.rail(year, sequence);
		return sequence;
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
				(id) => !frontier.settledIds.has(id)
			);
			if (!founder) return;
			const firstSequence = /* Exact arithmetic: sequence starts at zero each year. */ 0;
			build(founder, recipe.startYear, firstSequence, 'founding');
			for (let sequence = 1; sequence < recipe.minimumFoundingHoldings; sequence++) {
				if (!settle(recipe.startYear, sequence, 'founding'))
					throw Error('Missing reachable founding holding');
			}
		},
		expand(year: number) {
			const first = openPublicWorks(year);
			let sequence = first;
			const capacity = Math.min(
				recipe.holdingsPerStep,
				recipe.maximumActiveHoldings - stock.holdings.size
			);
			const limit = sequence + capacity;
			const newBank = works?.readNewBank(year);
			if (
				sequence < limit &&
				newBank &&
				settle(year, sequence, 'expansion', sequence - first, newBank)
			)
				sequence++;
			for (const [id, catchment] of works?.centers ?? []) {
				if (sequence === limit) break;
				if (settle(year, sequence, 'expansion', sequence - first, catchment, id)) sequence++;
			}
			while (sequence < limit && settle(year, sequence, 'expansion', sequence - first)) sequence++;
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
