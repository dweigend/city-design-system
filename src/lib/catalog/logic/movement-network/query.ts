import { edgeAdmitted, portAdmitted, validateQuery } from './query-filter';
import type {
	MovementEdge,
	MovementElement,
	MovementPath,
	MovementPathQuery,
	MovementPort,
	Position
} from './types';

// Complete-route shortest-path tie threshold in metres before lexical edge-ID tie-breaking.
const distanceTieTolerance = 1e-9;

type SearchState = { distance: number; portIds: string[]; edgeIds: string[] };
type Neighbor = { to: string; edge: MovementEdge };
type ReverseShortest = {
	distToGoal: ReadonlyMap<string, number>;
	hopsToGoal: ReadonlyMap<string, number>;
	nextToGoal: ReadonlyMap<string, Neighbor>;
};
type CanonicalSearch = {
	adjacency: ReadonlyMap<string, readonly Neighbor[]>;
	distToGoal: ReadonlyMap<string, number>;
	hopsToGoal: ReadonlyMap<string, number>;
	toPortId: string;
	shortest: number;
	portIds: string[];
	edgeIds: string[];
	visited: Set<string>;
};

function compareText(a: string, b: string) {
	return a < b ? -1 : a > b ? 1 : 0;
}
function routeLimit(shortest: number, hops: number): number {
	const relativeSlack = Math.max(1, shortest) * Math.max(1, hops) * Number.EPSILON * 4;
	return shortest + distanceTieTolerance + relativeSlack;
}
function buildAdjacency(
	edges: readonly MovementEdge[],
	ports: ReadonlyMap<string, MovementPort>,
	query: MovementPathQuery | undefined
) {
	const adjacency = new Map<string, Neighbor[]>();
	for (const id of ports.keys()) adjacency.set(id, []);
	for (const edge of edges) {
		const from = ports.get(edge.from),
			to = ports.get(edge.to);
		if (!from || !to || !edgeAdmitted(edge, from, to, query)) continue;
		adjacency.get(edge.from)?.push({ to: edge.to, edge });
		adjacency.get(edge.to)?.push({ to: edge.from, edge });
	}
	for (const entries of adjacency.values())
		entries.sort((l, r) => compareText(l.edge.id, r.edge.id) || compareText(l.to, r.to));
	return adjacency;
}
function nextUnsettledDistance(
	distances: ReadonlyMap<string, number>,
	settled: ReadonlySet<string>
): [string, number] | undefined {
	let chosen: [string, number] | undefined;
	for (const entry of distances) {
		if (settled.has(entry[0])) continue;
		if (!chosen || entry[1] < chosen[1] || (entry[1] === chosen[1] && entry[0] < chosen[0]))
			chosen = entry;
	}
	return chosen;
}
function shortestDistancesToGoal(
	adjacency: ReadonlyMap<string, readonly Neighbor[]>,
	fromPortId: string,
	toPortId: string
): ReverseShortest {
	const distToGoal = new Map<string, number>([[toPortId, 0]]);
	const hopsToGoal = new Map<string, number>([[toPortId, 0]]);
	const nextToGoal = new Map<string, Neighbor>();
	const settled = new Set<string>();
	let shortest: number | undefined;
	let step = nextUnsettledDistance(distToGoal, settled);
	while (step) {
		const [portId, distance] = step;
		if (shortest !== undefined && distance > routeLimit(shortest, adjacency.size)) break;
		settled.add(portId);
		if (portId === fromPortId) shortest = distance;
		const hops = hopsToGoal.get(portId) ?? 0;
		for (const { to, edge } of adjacency.get(portId) ?? []) {
			if (settled.has(to)) continue;
			const nextDistance = distance + edge.length;
			const existing = distToGoal.get(to);
			if (existing === undefined || nextDistance < existing) {
				distToGoal.set(to, nextDistance);
				hopsToGoal.set(to, hops + 1);
				nextToGoal.set(to, { to: portId, edge });
			}
		}
		step = nextUnsettledDistance(distToGoal, settled);
	}
	return { distToGoal, hopsToGoal, nextToGoal };
}
function reconstructDijkstraPath(
	nextToGoal: ReadonlyMap<string, Neighbor>,
	fromPortId: string,
	toPortId: string
): SearchState | undefined {
	const portIds = [fromPortId];
	const edgeIds: string[] = [];
	const seen = new Set([fromPortId]);
	let distance = 0;
	let current = fromPortId;
	while (current !== toPortId) {
		const step = nextToGoal.get(current);
		if (!step || seen.has(step.to)) return undefined;
		seen.add(step.to);
		portIds.push(step.to);
		edgeIds.push(step.edge.id);
		distance += step.edge.length;
		current = step.to;
	}
	return { distance, portIds, edgeIds };
}
function searchCanonicalPath(
	search: CanonicalSearch,
	portId: string,
	distance: number
): SearchState | undefined {
	for (const { to, edge } of search.adjacency.get(portId) ?? []) {
		if (search.visited.has(to)) continue;
		const remaining = search.distToGoal.get(to);
		if (remaining === undefined) continue;
		const nextDistance = distance + edge.length;
		const totalHops = search.edgeIds.length + 1 + (search.hopsToGoal.get(to) ?? 0);
		if (nextDistance + remaining > routeLimit(search.shortest, totalHops)) continue;
		if (to === search.toPortId)
			return {
				distance: nextDistance,
				portIds: [...search.portIds, to],
				edgeIds: [...search.edgeIds, edge.id]
			};
		search.visited.add(to);
		search.portIds.push(to);
		search.edgeIds.push(edge.id);
		const found = searchCanonicalPath(search, to, nextDistance);
		if (found) return found;
		search.edgeIds.pop();
		search.portIds.pop();
		search.visited.delete(to);
	}
	return undefined;
}
function samePosition(a: Position, b: Position) {
	return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}
function appendSegment(
	points: Position[],
	edge: MovementElement,
	from: MovementPort,
	to: MovementPort,
	reversed: boolean
) {
	const segment: Position[] = [from.position, ...(edge.via ?? []), to.position].map(
		([x, y, z]) => [x, y, z] as const
	);
	if (reversed) segment.reverse();
	for (const point of segment)
		if (!points.length || !samePosition(points[points.length - 1], point)) points.push(point);
}
function assemblePath(
	state: SearchState,
	edgesById: ReadonlyMap<string, MovementEdge>,
	ports: ReadonlyMap<string, MovementPort>
): MovementPath {
	const points: Position[] = [];
	const visitedPorts = state.portIds.map((id) => ports.get(id)).filter((p) => p !== undefined);
	let totalLength = 0,
		maxGrade = 0,
		minWidth = Math.min(...visitedPorts.map((p) => p.width));
	const minHeadroom = Math.min(...visitedPorts.map((p) => p.headroom));
	for (let i = 0; i < state.edgeIds.length; i++) {
		const edge = edgesById.get(state.edgeIds[i]);
		const from = edge && ports.get(edge.from),
			to = edge && ports.get(edge.to);
		if (!edge || !from || !to) continue;
		totalLength += edge.length;
		maxGrade = Math.max(maxGrade, edge.maxGrade);
		minWidth = Math.min(minWidth, edge.width);
		appendSegment(points, edge, from, to, edge.to === state.portIds[i]);
	}
	return {
		portIds: [...state.portIds],
		edgeIds: [...state.edgeIds],
		totalLength,
		maxGrade,
		minWidth,
		minHeadroom,
		points
	};
}

/** Finds the shortest deterministic bidirectional path between two ports on a MovementGraph.
 *
 * Weights edges by centreline `length` in metres, allowing zero-cost seams (`dock`) and reverse
 * traversal. Complete-route length ties within 1e-9 m of the exact shortest distance are broken
 * canonically by lexicographic edge-ID sequence so the result does not depend on input edge order.
 * Returns `undefined` when either port is unknown or no path satisfies `query`; returns a detached
 * `MovementPath` without mutating `graph`.
 *
 * Optional `query` bounds: `modes` filters `edge.mode`, `excludeKinds` filters `edge.kind` (e.g.
 * `['stair']` for step-free routes), `maxGrade` filters `edge.maxGrade` (dimensionless, 1e-9
 * tolerance), `minWidth` filters `min(edge.width, from.width, to.width)` in metres, and
 * `minHeadroom` filters endpoint port headroom metadata in metres (not a spatial sweep).
 * Throws `RangeError` if a numeric query bound is negative or non-finite. */
export function findMovementPath(
	graph: { ports: readonly MovementPort[]; edges: readonly MovementEdge[] },
	fromPortId: string,
	toPortId: string,
	query?: MovementPathQuery
): MovementPath | undefined {
	validateQuery(query);
	const ports = new Map(graph.ports.map((p) => [p.id, p]));
	const start = ports.get(fromPortId),
		goal = ports.get(toPortId);
	if (!start || !goal || !portAdmitted(start, query) || !portAdmitted(goal, query)) return;
	if (fromPortId === toPortId) {
		return {
			portIds: [fromPortId],
			edgeIds: [],
			totalLength: 0,
			maxGrade: 0,
			minWidth: start.width,
			minHeadroom: start.headroom,
			points: [[start.position[0], start.position[1], start.position[2]]]
		};
	}
	const adjacency = buildAdjacency(graph.edges, ports, query);
	const reverse = shortestDistancesToGoal(adjacency, fromPortId, toPortId);
	const shortest = reverse.distToGoal.get(fromPortId);
	if (shortest === undefined) return undefined;
	const search: CanonicalSearch = {
		adjacency,
		distToGoal: reverse.distToGoal,
		hopsToGoal: reverse.hopsToGoal,
		toPortId,
		shortest,
		portIds: [fromPortId],
		edgeIds: [],
		visited: new Set([fromPortId])
	};
	const state =
		searchCanonicalPath(search, fromPortId, 0) ??
		reconstructDijkstraPath(reverse.nextToGoal, fromPortId, toPortId);
	if (!state) return undefined;
	return assemblePath(state, new Map(graph.edges.map((e) => [e.id, e])), ports);
}
