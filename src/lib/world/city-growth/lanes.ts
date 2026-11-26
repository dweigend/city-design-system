import { required } from '../../core/invariant';
import type { ParcelLane } from '../../domain/parcels';

export type LaneAccess = Readonly<{ laneId: string; path: readonly ParcelLane[]; lengthM: number }>;

export function readLanesAtNodes(lanes: readonly ParcelLane[]) {
	const lanesAtNode = new Map<string, ParcelLane[]>();
	for (const lane of lanes) {
		for (const nodeId of lane.nodeIds) {
			const atNode = lanesAtNode.get(nodeId) ?? [];
			atNode.push(lane);
			lanesAtNode.set(nodeId, atNode);
		}
	}
	return lanesAtNode;
}

function laneNeighbors(lanes: readonly ParcelLane[]) {
	const lanesAtNode = readLanesAtNodes(lanes);
	return new Map(
		lanes.map((lane) => {
			const neighbors = lane.nodeIds
				.flatMap((id) => required(lanesAtNode.get(id), 'lane endpoint'))
				.sort((a, b) => (a.id < b.id ? -1 : Number(a.id > b.id)));
			return [lane.id, neighbors];
		})
	);
}

function laneReach(
	root: ParcelLane,
	neighbors: ReturnType<typeof laneNeighbors>,
	frontageLaneIds: ReadonlySet<string>,
	maximumHops: number
) {
	const reached = new Set([root.id]);
	const noExtensionM = /* Exact arithmetic: the root lane is already open. */ 0;
	const queue = [{ lane: root, path: [] as ParcelLane[], lengthM: noExtensionM }];
	const access: LaneAccess[] = [];
	for (const { lane, path, lengthM } of queue) {
		if (frontageLaneIds.has(lane.id)) access.push({ laneId: lane.id, path, lengthM });
		if (path.length >= maximumHops) continue;
		for (const next of required(neighbors.get(lane.id), 'lane neighbors')) {
			if (reached.has(next.id)) continue;
			reached.add(next.id);
			queue.push({ lane: next, path: [...path, next], lengthM: lengthM + next.lengthM });
		}
	}
	return access;
}

export function readLaneAccess(
	lanes: readonly ParcelLane[],
	frontageLaneIds: ReadonlySet<string>,
	maximumHops: number
) {
	const neighbors = laneNeighbors(lanes);
	return new Map(
		lanes.map((lane) => [lane.id, laneReach(lane, neighbors, frontageLaneIds, maximumHops)])
	);
}

export function readPendingAccess(access: LaneAccess, open: ReadonlySet<string>): LaneAccess {
	const lastOpen = access.path.findLastIndex(({ id }) => open.has(id));
	if (lastOpen < 0) return access;
	const path = access.path.slice(lastOpen + 1);
	return {
		laneId: access.laneId,
		path,
		lengthM: path.reduce((length, lane) => length + lane.lengthM, 0)
	};
}
