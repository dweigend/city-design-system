import { edgeAdmitted, portAdmitted, validateQuery } from './query-filter';
import type {
	MovementEdge,
	MovementElement,
	MovementPath,
	MovementPathQuery,
	MovementPort,
	Position
} from './types';

type Route = { portIds: string[]; edgeIds: string[] };
type Label = Route & { portId: string; lengthUnits: bigint };
type Neighbor = { to: string; edgeId: string; lengthUnits: bigint };

// Every finite nonnegative binary64 length is an integer multiple of 2^-1074 metres.
function exactLengthUnits(length: number, buffer: DataView): bigint {
	buffer.setFloat64(0, length);
	const bits = buffer.getBigUint64(0);
	const exponent = (bits >> 52n) & 2047n;
	const implicitBit = 1n << 52n;
	const fraction = bits & (implicitBit - 1n);
	return exponent === 0n ? fraction : (implicitBit | fraction) << (exponent - 1n);
}

function buildAdjacency(
	edges: readonly MovementEdge[],
	ports: ReadonlyMap<string, MovementPort>,
	query: MovementPathQuery | undefined
) {
	const adjacency = new Map<string, Neighbor[]>();
	for (const id of ports.keys()) adjacency.set(id, []);
	const buffer = new DataView(new ArrayBuffer(8));
	for (const edge of edges) {
		const from = ports.get(edge.from);
		const to = ports.get(edge.to);
		if (!from || !to || !edgeAdmitted(edge, from, to, query)) continue;
		const lengthUnits = exactLengthUnits(edge.length, buffer);
		adjacency.get(from.id)?.push({ to: to.id, edgeId: edge.id, lengthUnits });
		adjacency.get(to.id)?.push({ to: from.id, edgeId: edge.id, lengthUnits });
	}
	return adjacency;
}

function compareLabels(a: Label, b: Label): number {
	if (a.lengthUnits !== b.lengthUnits) return a.lengthUnits < b.lengthUnits ? -1 : 1;
	if (a.edgeIds.length !== b.edgeIds.length) return a.edgeIds.length - b.edgeIds.length;
	for (let i = 0; i < a.edgeIds.length; i++) {
		if (a.edgeIds[i] !== b.edgeIds[i]) return a.edgeIds[i] < b.edgeIds[i] ? -1 : 1;
	}
	return 0;
}

function leastLabel(labels: Iterable<Label>): Label | undefined {
	let least: Label | undefined;
	for (const label of labels) if (!least || compareLabels(label, least) < 0) least = label;
	return least;
}

function shortestRoute(
	adjacency: ReadonlyMap<string, readonly Neighbor[]>,
	fromPortId: string,
	toPortId: string
): Route | undefined {
	const first: Label = { portId: fromPortId, lengthUnits: 0n, portIds: [fromPortId], edgeIds: [] };
	const pending = new Map([[fromPortId, first]]);
	const settled = new Set<string>();
	// A shared suffix preserves label order. Even a zero-length edge increases edge count,
	// so extensions always rank after their prefixes and settled ports never need reopening.
	for (let label = leastLabel(pending.values()); label; label = leastLabel(pending.values())) {
		if (label.portId === toPortId) return label;
		pending.delete(label.portId);
		settled.add(label.portId);
		for (const { to, edgeId, lengthUnits } of adjacency.get(label.portId) ?? []) {
			if (settled.has(to)) continue;
			const candidate: Label = {
				portId: to,
				lengthUnits: label.lengthUnits + lengthUnits,
				portIds: [...label.portIds, to],
				edgeIds: [...label.edgeIds, edgeId]
			};
			const best = pending.get(to);
			if (!best || compareLabels(candidate, best) < 0) pending.set(to, candidate);
		}
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
	state: Route,
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
 * Compares the exact sum of stored binary64 edge lengths in metres, then edge count, then
 * the traversal's edge-ID sequence in lexicographic UTF-16 order. Zero-length seams are
 * supported. Only the returned `totalLength` uses binary64 addition in traversal order.
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
	const route = shortestRoute(adjacency, fromPortId, toPortId);
	if (!route) return undefined;
	return assemblePath(route, new Map(graph.edges.map((edge) => [edge.id, edge])), ports);
}
