import type {
	MovementEdge,
	MovementElement,
	MovementPath,
	MovementPathQuery,
	MovementPort,
	Position
} from './types';

// Dimensionless grade comparison tolerance from ST1 build-space contract.
const gradeComparisonTolerance = 1e-9;
// Width and headroom bound comparison tolerance in metres.
const dimensionComparisonTolerance = 1e-9;
// Shortest-path distance tie threshold in metres before lexical edge-ID tie-breaking.
const distanceTieTolerance = 1e-9;

type SearchState = { distance: number; portIds: string[]; edgeIds: string[] };
type Neighbor = { to: string; edge: MovementEdge };

function validateBound(name: string, value: number | undefined) {
	if (value !== undefined && (!Number.isFinite(value) || value < 0))
		throw new RangeError(`Invalid movement query ${name}: ${value}`);
}
function validateQuery(query: MovementPathQuery | undefined) {
	if (!query) return;
	validateBound('maxGrade', query.maxGrade);
	validateBound('minWidth', query.minWidth);
	validateBound('minHeadroom', query.minHeadroom);
}
function portAdmitted(port: MovementPort, query: MovementPathQuery | undefined) {
	if (!query) return true;
	const widthOk =
		query.minWidth === undefined || port.width + dimensionComparisonTolerance >= query.minWidth;
	const headroomOk =
		query.minHeadroom === undefined ||
		port.headroom + dimensionComparisonTolerance >= query.minHeadroom;
	return widthOk && headroomOk;
}
function edgeBoundsAdmitted(edge: MovementEdge, query: MovementPathQuery) {
	if (query.maxGrade !== undefined && edge.maxGrade > query.maxGrade + gradeComparisonTolerance)
		return false;
	return (
		query.minWidth === undefined || edge.width + dimensionComparisonTolerance >= query.minWidth
	);
}
function edgeAdmitted(
	edge: MovementEdge,
	from: MovementPort,
	to: MovementPort,
	query: MovementPathQuery | undefined
) {
	if (!query) return true;
	if (!portAdmitted(from, query) || !portAdmitted(to, query)) return false;
	if (query.modes && !query.modes.includes(edge.mode)) return false;
	if (query.excludeKinds?.includes(edge.kind)) return false;
	return edgeBoundsAdmitted(edge, query);
}
function compareEdgeIds(a: readonly string[], b: readonly string[]) {
	const count = Math.min(a.length, b.length);
	for (let i = 0; i < count; i++) {
		if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
	}
	return a.length - b.length;
}
function isBetterState(candidate: SearchState, current: SearchState) {
	if (candidate.distance < current.distance - distanceTieTolerance) return true;
	if (candidate.distance > current.distance + distanceTieTolerance) return false;
	return compareEdgeIds(candidate.edgeIds, current.edgeIds) < 0;
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
	for (const entries of adjacency.values()) {
		entries.sort((l, r) =>
			l.to !== r.to ? (l.to < r.to ? -1 : 1) : l.edge.id < r.edge.id ? -1 : 1
		);
	}
	return adjacency;
}
function isEarlierFrontier(candidate: [string, SearchState], chosen: [string, SearchState]) {
	if (isBetterState(candidate[1], chosen[1])) return true;
	if (isBetterState(chosen[1], candidate[1])) return false;
	return candidate[0] < chosen[0];
}
function nextUnsettled(best: ReadonlyMap<string, SearchState>, settled: ReadonlySet<string>) {
	let chosen: [string, SearchState] | undefined;
	for (const entry of best) {
		if (settled.has(entry[0])) continue;
		if (!chosen || isEarlierFrontier(entry, chosen)) chosen = entry;
	}
	return chosen;
}
function relaxNeighbors(
	neighbors: readonly Neighbor[],
	state: SearchState,
	settled: ReadonlySet<string>,
	best: Map<string, SearchState>
) {
	for (const { to, edge } of neighbors) {
		if (settled.has(to) || state.edgeIds.includes(edge.id)) continue;
		const candidate: SearchState = {
			distance: state.distance + edge.length,
			portIds: [...state.portIds, to],
			edgeIds: [...state.edgeIds, edge.id]
		};
		const existing = best.get(to);
		if (!existing || isBetterState(candidate, existing)) best.set(to, candidate);
	}
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
	for (const point of segment) {
		if (!points.length || !samePosition(points[points.length - 1], point)) points.push(point);
	}
}
function assemblePath(
	state: SearchState,
	edgesById: ReadonlyMap<string, MovementEdge>,
	ports: ReadonlyMap<string, MovementPort>
): MovementPath {
	const points: Position[] = [];
	const visitedPorts = state.portIds.map((id) => ports.get(id)).filter((p) => p !== undefined);
	const minHeadroom = Math.min(...visitedPorts.map((p) => p.headroom));
	let totalLength = 0,
		maxGrade = 0,
		minWidth = Math.min(...visitedPorts.map((p) => p.width));
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
 * traversal. Ties within 1e-9 m are broken canonically by lexicographic edge-ID sequence so the
 * result does not depend on input edge order. Returns `undefined` when either port is unknown or
 * no path satisfies `query`; returns a detached `MovementPath` without mutating `graph`.
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
	const edgesById = new Map(graph.edges.map((e) => [e.id, e]));
	const best = new Map<string, SearchState>([
		[fromPortId, { distance: 0, portIds: [fromPortId], edgeIds: [] }]
	]);
	const settled = new Set<string>();
	for (let step = nextUnsettled(best, settled); step; step = nextUnsettled(best, settled)) {
		const [portId, state] = step;
		settled.add(portId);
		if (portId === toPortId) return assemblePath(state, edgesById, ports);
		relaxNeighbors(adjacency.get(portId) ?? [], state, settled, best);
	}
	return undefined;
}
