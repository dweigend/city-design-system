import { hashUnit } from '../../core/random';
import { distance, nearest, survey } from './clearance';
import { epsilon, type NetworkInput, type Point, type Segment } from './types';

type Field = ReturnType<typeof survey>;
type Target = { point: Point; segment: Segment; cost: number };
function attachment(p: Point, tree: Segment[], field: Field) {
	let best: Target | undefined;
	for (const segment of tree) {
		const projection = nearest(p, segment);
		for (const point of [projection, segment.a, segment.b]) {
			const cost = distance(p, point);
			if (cost >= (best?.cost ?? Infinity) || !field.clear(p, point)) continue;
			best = { point, segment, cost };
		}
	}
	return best;
}
function relax(i: number, points: Point[], cost: number[], prev: number[], field: Field) {
	for (let j = 1; j < points.length; j++) {
		const next = cost[i] + distance(points[i], points[j]);
		if (next + epsilon >= cost[j] || !field.clear(points[i], points[j])) continue;
		cost[j] = next;
		prev[j] = i;
	}
}
// Dijkstra on visible corners. The last arc can terminate anywhere on an existing span.
function branch(start: Point, tree: Segment[], field: Field) {
	const points = [start, ...field.corners],
		cost = points.map(() => Infinity),
		prev = points.map(() => -1);
	const pending = new Set(points.keys());
	cost[0] = 0;
	let best: Target | undefined,
		end = 0;
	while (pending.size) {
		const i = Array.from(pending).reduce((a, b) => (cost[a] <= cost[b] ? a : b));
		if (cost[i] >= (best?.cost ?? Infinity)) break;
		pending.delete(i);
		const target = attachment(points[i], tree, field);
		if (target && cost[i] + target.cost < (best?.cost ?? Infinity)) {
			best = { ...target, cost: cost[i] + target.cost };
			end = i;
		}
		relax(i, points, cost, prev, field);
	}
	if (!best) throw new RangeError('No clear route to an entrance');
	const path = [best.point];
	for (let i = end; i !== -1; i = prev[i]) path.push(points[i]);
	return { path, target: best };
}
export function split(tree: Segment[], s: Segment, p: Point) {
	if (distance(p, s.a) < epsilon) return s.a;
	if (distance(p, s.b) < epsilon) return s.b;
	tree.splice(tree.indexOf(s), 1, { a: s.a, b: p }, { a: p, b: s.b });
	return p;
}
export function groundTree(houses: NetworkInput['houses'], seed: number, field: Field) {
	const first = houses[0].entrance;
	const tree: Segment[] = [{ a: first, b: first }];
	const corners = [...field.corners].sort((a, b) => hashUnit(seed, ...a) - hashUnit(seed, ...b));
	for (const h of houses.slice(1)) {
		const { path, target } = branch(h.entrance, tree, { ...field, corners });
		path[0] = split(tree, target.segment, target.point);
		for (let i = 1; i < path.length; i++) {
			if (distance(path[i - 1], path[i]) > epsilon) tree.push({ a: path[i - 1], b: path[i] });
		}
	}
	return tree.filter((s) => distance(s.a, s.b) > epsilon);
}
export function entranceTree(points: Point[]) {
	const order: number[] = [];
	const costs = points.map(() => Infinity),
		pending = new Set(points.keys());
	let total = 0;
	costs[0] = 0;
	while (pending.size) {
		const i = Array.from(pending).reduce((a, b) => (costs[a] <= costs[b] ? a : b));
		pending.delete(i);
		order.push(i);
		total += costs[i];
		for (const j of pending) costs[j] = Math.min(costs[j], distance(points[i], points[j]));
	}
	return { order, total };
}
