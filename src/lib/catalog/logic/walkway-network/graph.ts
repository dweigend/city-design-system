import { distance, mix } from './clearance';
import { plan, type deckOptions } from './deck-route';
import { split } from './ground-tree';
import {
	epsilon,
	width,
	type Edge,
	type Network,
	type NetworkInput,
	type Point,
	type Position,
	type Segment
} from './types';

type Option = ReturnType<typeof deckOptions>[number];
const key = (p: Position) => p.join(',');
function edge(kind: Edge['kind'], points: Position[]): Edge {
	const from = key(points[0]),
		to = key(points[points.length - 1]);
	return { id: kind + '/' + from + '/' + to, from, to, kind, points };
}
function samples(s: Segment, spacing: number, height: (p: Point) => number) {
	const n = Math.ceil(distance(s.a, s.b) / spacing);
	return Array.from({ length: n + 1 }, (_, i): Position => {
		const p = i === n ? s.b : mix(s.a, s.b, i / n);
		return [...p, height(p)];
	});
}
function groundEdges(tree: Segment[], input: NetworkInput, plazas: Set<string>) {
	const ground = (p: Point) => input.terrain(...p);
	return tree.flatMap((s) => {
		const ends = samples(s, 25, ground);
		for (const p of ends.slice(1, -1)) plazas.add(key(p));
		return ends
			.slice(1)
			.map((p, i) => edge('ground', samples({ a: plan(ends[i]), b: plan(p) }, 1, ground)));
	});
}
function addFlight(option: Option, tree: Segment[], input: NetworkInput) {
	const { pair, entry, segment, foot, kind } = option;
	const anchor = split(tree, segment, entry);
	if (distance(anchor, foot) > epsilon) tree.push({ a: anchor, b: foot });
	const flight = edge(kind, [[...foot, input.terrain(...foot)], [...pair.first.p]]);
	const deck = option.route.map((link) =>
		edge(
			'deck',
			samples(link.span, 12, () => link.first.p[2])
		)
	);
	return [flight, ...deck];
}
function nodesFor(edges: Edge[], plazas: Set<string>, input: NetworkInput, option?: Option) {
	const nodes = new Map<string, Network['nodes'][number]>(),
		degree = new Map<string, number>();
	for (const e of edges)
		for (const p of [e.points[0], e.points[e.points.length - 1]]) {
			const id = key(p);
			nodes.set(id, { id, position: [...p], kind: plazas.has(id) ? 'plaza' : 'bend', houses: [] });
			degree.set(id, (degree.get(id) ?? 0) + 1);
		}
	for (const n of nodes.values()) if ((degree.get(n.id) ?? 0) > 2) n.kind = 'fork';
	for (const h of input.houses) {
		const n = nodes.get(key([...h.entrance, input.terrain(...h.entrance)]));
		if (!n) throw new RangeError('Entrance missing from network');
		n.houses.push(h.id);
		if (n.kind === 'bend') n.kind = degree.get(n.id) === 2 ? 'plaza' : 'entrance';
	}
	if (option) labelFlight(nodes, option, input);
	return [...nodes.values()];
}
function labelFlight(nodes: Map<string, Network['nodes'][number]>, o: Option, input: NetworkInput) {
	const foot = nodes.get(key([...o.foot, input.terrain(...o.foot)]));
	if (foot) foot.kind = o.kind;
	for (const port of [o.pair.first, ...o.route.map((link) => link.second)]) {
		const node = nodes.get(key(port.p));
		if (node) {
			node.kind = 'port';
			node.houses.push(port.id);
		}
	}
}
function measure(edges: Edge[]) {
	let length = 0,
		area = 0;
	for (const e of edges)
		for (let i = 1; i < e.points.length; i++) {
			const p = e.points[i],
				a = e.points[i - 1],
				run = distance(plan(a), plan(p));
			length += Math.hypot(run, p[2] - a[2]);
			area += run * width;
		}
	return { length, area };
}
export function layout(input: NetworkInput, tree: Segment[], entranceMst: number, option?: Option) {
	const spans = [...tree],
		plazas = new Set<string>();
	const raised = option ? addFlight(option, spans, input) : [];
	const edges = [...groundEdges(spans, input, plazas), ...raised];
	const nodes = nodesFor(edges, plazas, input, option);
	const { length, area } = measure(edges);
	const planArea = area + nodes.filter(isPlaza).length * Math.PI * (width / 2) ** 2;
	return { nodes, edges, entranceMst, length, planArea };
}
export function isPlaza(node: Network['nodes'][number]) {
	return node.kind === 'fork' || node.kind === 'plaza' || node.kind === 'bend';
}
