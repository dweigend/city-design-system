import { Heap } from './heap';
import { validateCandidates, type Connection, type PortNetwork } from './ports';
export type Terminal = { id: string; ports: readonly string[] };
export type SteinerOptions = {
	minWidth: number;
	ownerGap: number;
	loops: number;
	ratio: number;
	fresh: number;
	pairs: number;
	perMetre: number;
	bias: number;
};
export type SteinerResult = {
	ports: string[];
	edges: Connection[];
	anchors: Map<string, string>;
	unreachable: string[];
	rejected: string[];
	loops: number;
};
/** Terminal-by-terminal shortest paths; stable candidate order and explicit exclusions. */
export function connectTerminals(
	net: PortNetwork,
	terminals: readonly Terminal[],
	exclusive: readonly (readonly [string, string])[],
	hint: ReadonlyMap<string, readonly [number, number, number]>,
	options: SteinerOptions
): SteinerResult {
	const ports = [...net.ports].sort((a, b) => (a.id < b.id ? -1 : 1)),
		ix = new Map(ports.map((p, i) => [p.id, i])),
		{ valid, rejected } = validateCandidates(ports, net.edges, options.minWidth);
	valid.sort((a, b) => (a.id < b.id ? -1 : 1));
	const adj = ports.map(() => [] as { to: number; e: Connection }[]),
		partners = new Map<string, string[]>();
	for (const e of valid) {
		const a = ix.get(e.a)!,
			b = ix.get(e.b)!;
		adj[a].push({ to: b, e });
		adj[b].push({ to: a, e });
	}
	for (const [a, b] of exclusive) {
		partners.set(a, [...(partners.get(a) ?? []), b]);
		partners.set(b, [...(partners.get(b) ?? []), a]);
	}
	const used = new Set<number>(),
		chosen = new Map<string, Connection>(),
		blocked = new Set<string>(),
		anchors = new Map<string, string>(),
		unreachable: string[] = [];
	const allowed = (k: number) => used.has(k) || !blocked.has(ports[k].id);
	const compatible = (path: number[], edges: Connection[]) => {
		const ids = new Set([...path.map((k) => ports[k].id), ...edges.map((e) => e.id)]);
		for (const id of ids) if ((partners.get(id) ?? []).some((v) => ids.has(v))) return false;
		for (let i = 0; i < path.length; i++)
			for (let j = 0; j < i; j++)
				if (
					ports[path[i]].owner === ports[path[j]].owner &&
					Math.abs(ports[path[i]].level - ports[path[j]].level) < options.ownerGap
				)
					return false;
		return true;
	};
	function search(
		sources: number[],
		target: (k: number) => boolean,
		limit = Infinity,
		tree = false
	) {
		const d = new Float64Array(ports.length).fill(Infinity),
			prev = new Int32Array(ports.length).fill(-1),
			via: Connection[] = [];
		const heap = new Heap();
		for (const k of sources)
			if (allowed(k)) {
				d[k] = 0;
				heap.push(0, k);
			}
		while (heap.size) {
			const [cost, k] = heap.pop();
			if (cost !== d[k] || cost > limit) continue;
			if (target(k)) {
				const path = [k],
					edges: Connection[] = [];
				while (prev[path[0]] >= 0) {
					edges.unshift(via[path[0]]);
					path.unshift(prev[path[0]]);
				}
				if (compatible(path, edges)) return { path, edges, cost };
			}
			for (const { to, e } of adj[k]) {
				if (
					(tree && !chosen.has(e.id)) ||
					(!tree && ((blocked.has(e.id) && !chosen.has(e.id)) || !allowed(to)))
				)
					continue;
				if (prev[k] >= 0 && ports[to].owner === ports[prev[k]].owner) continue;
				const nd = cost + e.cost;
				if (nd < d[to]) {
					d[to] = nd;
					prev[to] = k;
					via[to] = e;
					heap.push(nd, to);
				}
			}
		}
		return undefined;
	}
	const add = (path: number[], edges: Connection[]) => {
		for (const k of path) used.add(k);
		for (const e of edges) chosen.set(e.id, e);
		for (const id of [...path.map((k) => ports[k].id), ...edges.map((e) => e.id)])
			for (const p of partners.get(id) ?? []) blocked.add(p);
	};
	for (const [i, t] of terminals.entries()) {
		const candidates = t.ports
			.map((id) => ix.get(id))
			.filter((k): k is number => k !== undefined && allowed(k));
		if (i === 0) {
			if (candidates.length) {
				add([candidates[0]], []);
				anchors.set(t.id, ports[candidates[0]].id);
			} else unreachable.push(t.id);
			continue;
		}
		const hit = candidates.find((k) => used.has(k));
		if (hit !== undefined) {
			anchors.set(t.id, ports[hit].id);
			continue;
		}
		const found = search(candidates, (k) => used.has(k));
		if (!found) {
			unreachable.push(t.id);
			continue;
		}
		add(found.path, found.edges);
		anchors.set(t.id, ports[found.path[0]].id);
	}
	let loops = 0;
	for (; loops < options.loops; loops++) {
		const as = [...new Set(anchors.values())].sort(),
			pairs: { a: number; b: number; cost: number; rank: number }[] = [];
		for (let i = 0; i < as.length; i++)
			for (let j = i + 1; j < as.length; j++) {
				const a = ix.get(as[i])!,
					b = ix.get(as[j])!,
					found = search([a], (k) => k === b, Infinity, true);
				if (!found) continue;
				const p = hint.get(as[i])!,
					q = hint.get(as[j])!,
					air = Math.hypot(p[0] - q[0], p[1] - q[1]);
				pairs.push({
					a,
					b,
					cost: found.cost,
					rank: found.cost / (air * options.perMetre + options.bias)
				});
			}
		pairs.sort((a, b) => b.rank - a.rank || a.a - b.a || a.b - b.b);
		let best: ReturnType<typeof search>,
			gain = options.ratio;
		for (const p of pairs.slice(0, options.pairs)) {
			const f = search([p.a], (k) => k === p.b, p.cost / options.ratio);
			if (
				f &&
				f.path.filter((k) => !used.has(k)).length >= options.fresh &&
				p.cost / f.cost > gain
			) {
				gain = p.cost / f.cost;
				best = f;
			}
		}
		if (!best) break;
		add(best.path, best.edges);
	}
	return {
		ports: [...used].map((k) => ports[k].id).sort(),
		edges: [...chosen.values()],
		anchors,
		unreachable,
		rejected: rejected.sort(),
		loops
	};
}
