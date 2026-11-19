import { distance, separation, type survey } from './clearance';
import { epsilon, type NetworkInput, type Point, type Segment } from './types';

const mergeRadius = 3;
function proposedFork(p: Point, arms: Point[]): Point {
	const unit = arms.map((q) => {
		const d = distance(p, q);
		return [(q[0] - p[0]) / d, (q[1] - p[1]) / d];
	});
	const x = unit.reduce((s, u) => s + u[0], 0),
		y = unit.reduce((s, u) => s + u[1], 0);
	const norm = Math.hypot(x, y);
	if (norm < epsilon) return p;
	const step = Math.min(mergeRadius, ...arms.map((q) => distance(p, q) / 3));
	return [p[0] + (step * x) / norm, p[1] + (step * y) / norm];
}
function unobstructed(arm: Segment, others: Segment[]) {
	return others.every(
		(s) => [s.a, s.b].some((q) => distance(q, arm.b) < epsilon) || separation(arm, s) > epsilon
	);
}
// Relax free three-way junctions inside the shared-trunk radius. Fixed entrances and
// obstacle corners remain exact, and only the three incident spans can move.
export function shapeForks(tree: Segment[], input: NetworkInput, field: ReturnType<typeof survey>) {
	const fixed = new Set(
		[...input.houses.map((h) => h.entrance), ...field.corners].map((p) => p.join(','))
	);
	const joins = new Map<string, Point>();
	for (const s of tree) for (const p of [s.a, s.b]) joins.set(p.join(','), p);
	for (const [key, p] of joins) {
		if (fixed.has(key)) continue;
		relaxFork(tree, p, field);
	}
}

function relaxFork(tree: Segment[], p: Point, field: ReturnType<typeof survey>) {
	const incident = tree.filter((s) => s.a === p || s.b === p);
	if (incident.length !== 3) return;
	const arms = incident.map((s) => (s.a === p ? s.b : s.a));
	const q = proposedFork(p, arms);
	const others = tree.filter((s) => !incident.includes(s));
	if (!arms.every((b) => field.clear(q, b) && unobstructed({ a: q, b }, others))) return;
	if (arms.reduce((sum, b) => sum + distance(q, b) - distance(p, b), 0) >= 0) return;
	for (const s of incident) {
		if (s.a === p) s.a = q;
		else s.b = q;
	}
}
