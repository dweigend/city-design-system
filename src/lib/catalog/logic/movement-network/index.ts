import { dock } from './docking';
import type { DockRequest, MovementElement, MovementPort, MovementEdge } from './types';
export type { DockRequest, MovementElement, MovementKind, MovementPort } from './types';

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
function measure(edge: MovementElement, ports: Map<string, MovementPort>): MovementEdge {
	const a = endpoint(ports, edge.from),
		b = endpoint(ports, edge.to);
	let run = 0,
		length = 0,
		previous = a.position;
	for (const point of [...(edge.via ?? []), b.position]) {
		const d = Math.hypot(point[0] - previous[0], point[1] - previous[1]);
		run += d;
		length += Math.hypot(d, point[2] - previous[2]);
		previous = point;
	}
	if (
		!Number.isFinite(length) ||
		!(Number.isFinite(edge.capacity) && edge.capacity > 0) ||
		(!run && length)
	)
		throw new RangeError('Invalid movement element ' + edge.id);
	return { ...edge, length, grade: run ? (b.position[2] - a.position[2]) / run : 0 };
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
 * Length is centreline metres; signed mean grade is rise divided by horizontal chainage. */
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
