import { dock } from './docking';
import { findMovementPath } from './query';
import type {
	DockRequest,
	MovementEdge,
	MovementElement,
	MovementFragment,
	MovementPort
} from './types';
export { findMovementPath };
export type {
	DockRequest,
	MovementEdge,
	MovementElement,
	MovementFragment,
	MovementKind,
	MovementPath,
	MovementPathQuery,
	MovementPort,
	Position
} from './types';

function unique<T extends { id: string }>(records: readonly T[]) {
	const map = new Map(records.map((r) => [r.id, r]));
	if (map.size !== records.length || map.has(''))
		throw new RangeError('Expected unique movement identifiers');
	return map;
}
function endpoint(ports: Map<string, MovementPort>, id: string) {
	const p = ports.get(id);
	if (!p) throw new RangeError('Unknown movement port ' + id);
	return p;
}
function edgeWidth(edge: MovementElement, a: MovementPort, b: MovementPort) {
	const width = edge.width ?? Math.min(a.width, b.width);
	if (!Number.isFinite(width) || width <= 0)
		throw new RangeError('Invalid movement width ' + edge.id);
	return width;
}
function segmentGrade(run: number, rise: number) {
	if (run > 0) return rise / run;
	return rise > 0 ? Infinity : 0;
}
function measure(edge: MovementElement, ports: Map<string, MovementPort>): MovementEdge {
	const a = endpoint(ports, edge.from),
		b = endpoint(ports, edge.to);
	let run = 0,
		length = 0,
		maxGrade = 0,
		previous = a.position;
	for (const point of [...(edge.via ?? []), b.position]) {
		const d = Math.hypot(point[0] - previous[0], point[1] - previous[1]);
		const rise = Math.abs(point[2] - previous[2]);
		run += d;
		length += Math.hypot(d, rise);
		maxGrade = Math.max(maxGrade, segmentGrade(d, rise));
		previous = point;
	}
	if (
		!Number.isFinite(length) ||
		!(Number.isFinite(edge.capacity) && edge.capacity > 0) ||
		(!run && length)
	)
		throw new RangeError('Invalid movement element ' + edge.id);
	return {
		...edge,
		width: edgeWidth(edge, a, b),
		length,
		grade: run ? (b.position[2] - a.position[2]) / run : 0,
		maxGrade
	};
}
function unsupportedEnds(edges: MovementEdge[], removed: Set<string>) {
	const active = edges.filter((e) => !removed.has(e.from) && !removed.has(e.to));
	const partners = new Set(active.filter((e) => e.kind !== 'stair').flatMap((e) => [e.from, e.to]));
	return active
		.filter((e) => e.kind === 'stair' && !(partners.has(e.from) && partners.has(e.to)))
		.flatMap((e) => [e.from, e.to]);
}
function incompleteFlights(ports: Map<string, MovementPort>, edges: MovementEdge[]) {
	const removed = new Set<string>();
	for (
		let ends = unsupportedEnds(edges, removed);
		ends.length;
		ends = unsupportedEnds(edges, removed)
	) {
		for (const id of ends) {
			if (endpoint(ports, id).kind !== 'stair')
				throw new RangeError('A flight requires two stair ports');
			removed.add(id);
		}
	}
	return removed;
}
/** Assembles surveyed elements and compatible dock requests in input order. Geometric
 * mismatches are listed as unresolved. Malformed records and colliding IDs throw RangeError.
 * Length is centreline metres; signed mean `grade` is endpoint rise divided by horizontal
 * chainage; `maxGrade` is maximum absolute segment rise/run (ST1 `PathEdge.grade`, or `Infinity`
 * if an embedded nonzero vertical segment occurs inside a nonzero-run polyline). */
export function movementNetwork(
	inputs: readonly MovementPort[],
	elements: readonly MovementElement[],
	requests: readonly DockRequest[]
) {
	const ports = unique(inputs);
	for (const p of inputs)
		if (
			![...p.position, p.heading, p.width, p.headroom].every(Number.isFinite) ||
			p.width <= 0 ||
			p.headroom <= 0
		)
			throw new RangeError('Invalid movement port ' + p.id);
	unique(requests);
	const additions = requests.map((r) => dock(r, endpoint(ports, r.from), endpoint(ports, r.to)));
	const allPorts = unique([...inputs, ...additions.flatMap((a) => a.ports)]);
	const edges = [...unique([...elements, ...additions.flatMap((a) => a.edges)]).values()].map((e) =>
		measure(e, allPorts)
	);
	const removed = incompleteFlights(allPorts, edges);
	return {
		ports: [...allPorts.values()].filter((p) => !removed.has(p.id)),
		edges: edges.filter((e) => !removed.has(e.from) && !removed.has(e.to)),
		unresolved: requests
			.filter((r, i) => !additions[i].edges.length || removed.has(r.from) || removed.has(r.to))
			.map((r) => r.id)
	};
}

/** Composes movement graph fragments, extra seam/crossing edges and dock requests in input order
 * through one validated `movementNetwork` pass. Preserves stable IDs and rejects colliding IDs
 * or malformed records with `RangeError`. Returns a fresh `MovementGraph`; inputs are not mutated. */
export function composeMovementGraphs(
	fragments: readonly MovementFragment[],
	extraEdges: readonly MovementElement[] = [],
	requests: readonly DockRequest[] = []
): MovementGraph {
	return movementNetwork(
		fragments.flatMap((fragment) => fragment.ports),
		[...fragments.flatMap((fragment) => fragment.edges ?? []), ...extraEdges],
		[...fragments.flatMap((fragment) => fragment.requests ?? []), ...requests]
	);
}

/** Returns the ordered centreline of an edge in traversal order, including both ports. */
export function edgePath(edge: MovementElement, ports: ReadonlyMap<string, MovementPort>) {
	const from = ports.get(edge.from),
		to = ports.get(edge.to);
	if (!from || !to) throw new RangeError('Missing endpoint for ' + edge.id);
	return [from.position, ...(edge.via ?? []), to.position];
}
export type MovementGraph = ReturnType<typeof movementNetwork>;

/** Minimum clear walking height in metres for public circulation. */
export const pedestrianHeadroom = 2.2;
/** Default walking scenario in travellers per minute at one traveller per metre of width per second. */
export function walkingCapacity(width: number) {
	return 60 * width;
}
