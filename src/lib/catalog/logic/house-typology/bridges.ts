import { required } from '../required';
import type { Bridge, HouseComposition, Port, Point } from './types';

function direct(a: HouseComposition, b: HouseComposition) {
	const ids = new Set(b.cells.map((c) => c.id));
	return a.cells.some((c) => c.neighbors.some((n) => n !== null && ids.has(n)));
}
function bridgeKind(a: HouseComposition, b: HouseComposition, span: number): Bridge['kind'] {
	if (span < 0.3) return 'platform';
	if ([a.typology, b.typology].includes('bridge-house')) return 'bridge-house';
	return 'walkway';
}
function bridge(a: HouseComposition, b: HouseComposition, p: Port, q: Port, span: number): Bridge {
	const from = p.position,
		to = q.position;
	const pier: Point | undefined =
		span > 12
			? [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, Math.min(a.ground, b.ground)]
			: undefined;
	const z = (from[2] + to[2]) / 2;
	return {
		a: a.id,
		b: b.id,
		portA: p,
		portB: q,
		from: [from[0], from[1], z],
		to: [to[0], to[1], z],
		span,
		kind: bridgeKind(a, b, span),
		...(pier ? { pier } : {})
	};
}
function candidate(a: HouseComposition, b: HouseComposition): Bridge | undefined {
	if (!direct(a, b)) return;
	let best: Bridge | undefined;
	for (const p of a.ports)
		for (const q of b.ports) {
			const from = p.position,
				to = q.position;
			if (Math.abs(from[2] - to[2]) > 0.3 + 1e-9) continue;
			const span = Math.hypot(from[0] - to[0], from[1] - to[1]);
			if (span > 14 || (best && best.span <= span)) continue;
			best = bridge(a, b, p, q, span);
		}
	return best;
}
type Path = { mask: number; first: number; last: number; edges: Bridge[]; length: number };
function paths(edges: (Bridge | undefined)[][]) {
	const best = new Map<number, Path>();
	function visit(p: Path) {
		const prev = best.get(p.mask);
		if (!prev || prev.length > p.length) best.set(p.mask, p);
		for (const [j, e] of edges[p.last].entries()) {
			if (!e || p.mask & (1 << j)) continue;
			visit({
				mask: p.mask | (1 << j),
				first: p.first,
				last: j,
				edges: [...p.edges, e],
				length: p.length + e.span
			});
		}
	}
	edges.forEach((_, i) => visit({ mask: 1 << i, first: i, last: i, edges: [], length: 0 }));
	return best;
}
function bridgeEdges(compositions: readonly HouseComposition[]) {
	const houses = [...compositions].sort((a, b) => a.id.localeCompare(b.id));
	const edges = houses.map((a, i) => houses.map((b, j) => (i < j ? candidate(a, b) : undefined)));
	for (let i = 0; i < houses.length; i++) for (let j = 0; j < i; j++) edges[i][j] = edges[j][i];
	return edges;
}
function shortestForest(options: Map<number, Path>, all: number) {
	const forests = new Map<number, { edges: Bridge[]; length: number }>([
		[0, { edges: [], length: 0 }]
	]);
	for (let mask = 1; mask <= all; mask++) {
		for (const p of options.values()) {
			if ((mask & p.mask) !== p.mask) continue;
			const rest = required(forests.get(mask ^ p.mask), 'path forest'),
				best = forests.get(mask);
			const count = rest.edges.length + p.edges.length,
				length = rest.length + p.length;
			if (
				!best ||
				count > best.edges.length ||
				(count === best.edges.length && length < best.length)
			)
				forests.set(mask, { edges: [...rest.edges, ...p.edges], length });
		}
	}
	return required(forests.get(all), 'path forest').edges;
}
/** Finds a shortest spanning path when feasible, otherwise a minimum-component path forest.
 * With at least six sites a direct closing span may join the ends of the spanning path. */
export function planBridges(compositions: readonly HouseComposition[]): Bridge[] {
	if (compositions.length > 8) throw new RangeError('Bridge ensemble exceeds eight sites');
	const edges = bridgeEdges(compositions);
	const options = paths(edges),
		all = (1 << edges.length) - 1,
		path = options.get(all);
	if (path) {
		const closing = edges.length >= 6 && edges[path.first][path.last];
		return closing ? [...path.edges, closing] : path.edges;
	}
	return shortestForest(options, all);
}
