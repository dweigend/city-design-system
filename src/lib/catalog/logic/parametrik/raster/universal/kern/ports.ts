import { InvariantError } from './types';
export type Port = {
	id: string;
	owner: string;
	level: number;
	channel: 'walk' | 'supply' | 'support';
};
export type Connection = {
	id: string;
	a: string;
	b: string;
	cost: number;
	width: number;
	capacity: number;
	kind: 'horizontal' | 'stair' | 'lift' | 'ramp';
	clear: boolean;
	span: number;
	maxSpan: number;
};
export type PortNetwork = { ports: readonly Port[]; edges: readonly Connection[] };
export function distances(net: PortNetwork, start: string) {
	if (!net.ports.some((p) => p.id === start)) throw new InvariantError('unknown-port', [start]);
	const d = new Map(net.ports.map((p) => [p.id, p.id === start ? 0 : Infinity])),
		adj = new Map(net.ports.map((p) => [p.id, [] as { id: string; cost: number }[]]));
	for (const e of net.edges) {
		adj.get(e.a)!.push({ id: e.b, cost: e.cost });
		adj.get(e.b)!.push({ id: e.a, cost: e.cost });
	}
	// Indexed binary min-heap: at most one entry per port, decrease-key in O(log V).
	const heap = [start],
		positions = new Map([[start, 0]]);
	const swap = (a: number, b: number) => {
		[heap[a], heap[b]] = [heap[b], heap[a]];
		positions.set(heap[a], a);
		positions.set(heap[b], b);
	};
	const rise = (at: number) => {
		while (at > 0) {
			const parent = (at - 1) >> 1;
			if (d.get(heap[parent])! <= d.get(heap[at])!) break;
			swap(parent, at);
			at = parent;
		}
	};
	while (heap.length) {
		const u = heap[0],
			last = heap.pop()!;
		positions.delete(u);
		if (heap.length) {
			heap[0] = last;
			positions.set(last, 0);
			let at = 0;
			while (at * 2 + 1 < heap.length) {
				let child = at * 2 + 1;
				if (child + 1 < heap.length && d.get(heap[child + 1])! < d.get(heap[child])!) child++;
				if (d.get(heap[at])! <= d.get(heap[child])!) break;
				swap(at, child);
				at = child;
			}
		}
		for (const v of adj.get(u)!) {
			const distance = d.get(u)! + v.cost;
			if (distance >= d.get(v.id)!) continue;
			d.set(v.id, distance);
			let at = positions.get(v.id);
			if (at === undefined) {
				at = heap.length;
				heap.push(v.id);
				positions.set(v.id, at);
			}
			rise(at);
		}
	}
	return d;
}
/** Kruskal forest + greedy maximum absolute endpoint-detour saving. No proximity edges.
 * Candidate clearance/span attestations come from the caller's geometry/collision system.
 */
export function connectPorts(
	ports: readonly Port[],
	candidates: readonly Connection[],
	options = { minWidth: 1.2, loops: 1, minGain: 1 }
) {
	if (
		!Number.isInteger(options.loops) ||
		options.loops < 0 ||
		!Number.isFinite(options.minGain) ||
		options.minGain < 0
	)
		throw new InvariantError('invalid-port-options');
	const { valid, rejected } = validateCandidates(ports, candidates, options.minWidth);
	valid.sort((a, b) => a.cost - b.cost || (a.id < b.id ? -1 : 1));
	const parent = new Map(ports.map((p) => [p.id, p.id])),
		root = (v: string): string => {
			let p = v;
			while (parent.get(p) !== p) p = parent.get(p)!;
			return p;
		};
	const edges: Connection[] = [],
		unused: Connection[] = [];
	for (const e of valid) {
		const a = root(e.a),
			b = root(e.b);
		if (a !== b) {
			parent.set(a, b);
			edges.push(e);
		} else unused.push(e);
	}
	const treeEdges = edges.length;
	for (let n = 0; n < options.loops; n++) {
		let best: Connection | undefined,
			gain = options.minGain;
		for (const e of unused) {
			const g = distances({ ports, edges }, e.a).get(e.b)! - e.cost;
			if (g > gain || (g === gain && g > 0 && (!best || e.id < best.id))) {
				gain = g;
				best = e;
			}
		}
		if (!best) break;
		edges.push(best);
		unused.splice(unused.indexOf(best), 1);
	}
	const components = new Map<string, string[]>();
	for (const p of ports) {
		const r = root(p.id);
		if (!components.has(r)) components.set(r, []);
		components.get(r)!.push(p.id);
	}
	return { ports, edges, treeEdges, rejected, components: [...components.values()] };
}

export function validateCandidates(
	ports: readonly Port[],
	candidates: readonly Connection[],
	minWidth: number
) {
	const byId = new Map(ports.map((p) => [p.id, p]));
	if (
		byId.size !== ports.length ||
		ports.some(
			(p) => !Number.isInteger(p.level) || !['walk', 'supply', 'support'].includes(p.channel)
		) ||
		!Number.isFinite(minWidth) ||
		minWidth <= 0
	)
		throw new InvariantError('invalid-port-options');
	if (new Set(candidates.map((e) => e.id)).size !== candidates.length)
		throw new InvariantError('duplicate-connection');
	const rejected: string[] = [],
		valid: Connection[] = [];
	for (const e of candidates) {
		const a = byId.get(e.a),
			b = byId.get(e.b);
		if (!a || !b || a.id === b.id || !wellFormed(e))
			throw new InvariantError('invalid-connection', [e.id]);
		if (!passable(e, a, b, minWidth)) {
			rejected.push(e.id);
			continue;
		}
		valid.push(e);
	}

	return { valid, rejected };
}

function wellFormed(e: Connection) {
	return (
		[e.cost, e.width, e.capacity, e.span, e.maxSpan].every(Number.isFinite) &&
		e.cost > 0 &&
		e.width > 0 &&
		e.capacity > 0 &&
		e.span >= 0 &&
		e.maxSpan >= 0 &&
		['horizontal', 'stair', 'lift', 'ramp'].includes(e.kind)
	);
}

function passable(e: Connection, a: Port, b: Port, minWidth: number) {
	return (
		e.clear &&
		e.width >= minWidth &&
		e.span <= e.maxSpan &&
		a.channel === b.channel &&
		(e.kind !== 'horizontal' || a.level === b.level)
	);
}
