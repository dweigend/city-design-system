import type { ParcelLane } from '../../domain/parcels';
import type { GrowthCarrier, HoldingCandidate } from './carrier';
import { readPendingAccess, type LaneAccess } from './lanes';
import { developmentDefaults } from './recipe';

export type Frontier = Readonly<{
	settledIds: ReadonlySet<string>;
	lanes: ReadonlySet<string>;
	access: ReadonlyMap<string, LaneAccess>;
}>;

type Survey = NonNullable<GrowthCarrier['infrastructure']>;
type Crossing = GrowthCarrier['layout']['crossings'][number];
type Approach = Readonly<{ path: readonly ParcelLane[]; lengthM: number }>;
type Proposal = Readonly<{
	crossing: Crossing;
	approach: readonly ParcelLane[];
	landingPath: readonly ParcelLane[];
	fromNodeId: string;
	toNodeId: string;
	unlocked: readonly HoldingCandidate[];
	value: number;
}>;

export function readUnbuilt(carrier: GrowthCarrier, route: LaneAccess, frontier: Frontier) {
	return (carrier.holdingsByLane.get(route.laneId) ?? []).filter(
		({ parcel }) => !frontier.settledIds.has(parcel.id)
	);
}

function* readBankPaths(
	survey: Survey,
	head: string,
	open: ReadonlySet<string>,
	maximumHops: number
) {
	const roots = survey.lanesAtNode.get(head) ?? [];
	const seen = new Set(roots.map(({ id }) => id));
	const queue: Approach[] = roots.map((lane) => ({ path: [lane], lengthM: lane.lengthM }));
	for (const visit of queue) {
		yield visit;
		const { path, lengthM } = visit;
		const last = path[path.length - 1];
		if (open.has(last.id) || path.length > maximumHops) continue;
		for (const node of last.nodeIds) {
			for (const lane of survey.lanesAtNode.get(node) ?? []) {
				if (seen.has(lane.id)) continue;
				seen.add(lane.id);
				queue.push({ path: [...path, lane], lengthM: lengthM + lane.lengthM });
			}
		}
	}
}

function readApproach(survey: Survey, nodeId: string, open: ReadonlySet<string>) {
	for (const { path, lengthM } of readBankPaths(
		survey,
		nodeId,
		open,
		developmentDefaults.bridgeApproachHops
	)) {
		const last = path[path.length - 1];
		if (open.has(last.id))
			return { path: path.slice(0, -1).reverse(), lengthM: lengthM - last.lengthM };
	}
}

function* readLandings(
	carrier: GrowthCarrier,
	survey: Survey,
	frontier: Frontier,
	crossing: Crossing,
	fromNodeId: string,
	toNodeId: string
): Iterable<Proposal> {
	const approach = readApproach(survey, fromNodeId, frontier.lanes);
	if (!approach) return;
	const spanM = crossing.span?.lengthM ?? crossing.path.lengthM;
	const budget = developmentDefaults.bridgeApproachHops - approach.path.length;
	const sourceIds = new Set(approach.path.map(({ id }) => id));
	for (const landing of readBankPaths(survey, toNodeId, frontier.lanes, budget)) {
		const last = landing.path[landing.path.length - 1];
		if (frontier.lanes.has(last.id) || landing.path.length > budget) continue;
		if (landing.path.some(({ id }) => sourceIds.has(id))) continue;
		const costM = approach.lengthM + spanM + landing.lengthM;
		const unlocked = (carrier.accessByLane.get(last.id) ?? []).flatMap((route) => {
			const previous = frontier.access.get(route.laneId);
			const old = previous ? readPendingAccess(previous, frontier.lanes).lengthM : Infinity;
			return costM + route.lengthM < old ? readUnbuilt(carrier, route, frontier) : [];
		});
		if (!unlocked.length) continue;
		const areaM2 = unlocked.reduce((sum, { parcel }) => sum + parcel.areaM2, 0);
		yield {
			crossing,
			approach: approach.path,
			landingPath: landing.path,
			fromNodeId,
			toNodeId,
			unlocked,
			value: areaM2 / costM
		};
	}
}

export function readCrossing(
	carrier: GrowthCarrier,
	survey: Survey,
	frontier: Frontier,
	crossingIds: ReadonlySet<string>
) {
	let best: Proposal | undefined;
	for (const crossing of carrier.layout.crossings) {
		if (crossingIds.has(crossing.id)) continue;
		const [first, second] = crossing.heads;
		for (const [from, to] of [
			[first, second],
			[second, first]
		]) {
			for (const proposal of readLandings(
				carrier,
				survey,
				frontier,
				crossing,
				from.nodeId,
				to.nodeId
			)) {
				if (!best || proposal.value > best.value) best = proposal;
			}
		}
	}
	return best;
}
