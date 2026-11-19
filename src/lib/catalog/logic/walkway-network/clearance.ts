import { epsilon, width, type NetworkInput, type Point, type Segment } from './types';

export const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const mix = (a: Point, b: Point, t: number): Point => [
	a[0] + (b[0] - a[0]) * t,
	a[1] + (b[1] - a[1]) * t
];
const cross = (a: Point, b: Point, c: Point) =>
	(b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function sides(ring: readonly Point[]): Segment[] {
	return ring.map((a, i) => ({ a, b: ring[(i + 1) % ring.length] }));
}
function offset({ a, b }: Segment, r: number): Segment {
	const d = distance(a, b);
	if (d < epsilon) throw new RangeError('Degenerate obstacle side');
	const dx = (r * (b[1] - a[1])) / d,
		dy = (r * (a[0] - b[0])) / d;
	return { a: [a[0] + dx, a[1] + dy], b: [b[0] + dx, b[1] + dy] };
}
function inflate(points: readonly Point[], r: number) {
	if (points.length < 3 || points.some((p) => !p.every(Number.isFinite)))
		throw new RangeError('Invalid obstacle outline');
	const area = sides(points).reduce((s, { a, b }) => s + a[0] * b[1] - a[1] * b[0], 0);
	const ring = area > 0 ? [...points] : [...points].reverse();
	const lines = sides(ring).map((s) => offset(s, r));
	return lines.map(({ a, b }, i) => {
		const prev = lines[(i + lines.length - 1) % lines.length];
		const start = cross(prev.a, prev.b, a),
			turn = cross(prev.a, prev.b, b) - start;
		if (turn <= epsilon) throw new RangeError('Expected a strictly convex obstacle cell');
		return mix(a, b, -start / turn);
	});
}
function houseRings(input: NetworkInput) {
	return input.houses.flatMap((h) =>
		h.obstacles.map(({ position: [x, y], size: [w, d] }) => {
			if (!(w > 0 && d > 0)) throw new RangeError('Invalid house extent');
			return inflate(
				[
					[x - w / 2, y - d / 2],
					[x + w / 2, y - d / 2],
					[x + w / 2, y + d / 2],
					[x - w / 2, y + d / 2]
				],
				1 + width / 2
			);
		})
	);
}
// Clip against the open interior. A tangent or boundary run retains full clearance.
function cutsInterior(a: Point, b: Point, boundary: Segment[]) {
	let lo = 0,
		hi = 1;
	for (const s of boundary) {
		const u = cross(s.a, s.b, a) - epsilon,
			v = cross(s.a, s.b, b) - epsilon;
		if (u <= 0 && v <= 0) return false;
		if (u <= 0) lo = Math.max(lo, u / (u - v));
		if (v <= 0) hi = Math.min(hi, u / (u - v));
	}
	return lo < hi;
}
export function survey(input: NetworkInput) {
	const rings = [...houseRings(input), ...input.blockedCells.map((p) => inflate(p, width / 2))];
	const boundaries = rings.map(sides);
	const clear = (a: Point, b: Point) => boundaries.every((r) => !cutsInterior(a, b, r));
	return { clear, corners: rings.flat().filter((p) => clear(p, p)) };
}
export function nearest(p: Point, { a, b }: Segment): Point {
	const dx = b[0] - a[0],
		dy = b[1] - a[1],
		sq = dx * dx + dy * dy;
	if (!sq) return a;
	const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / sq;
	if (t <= 0) return a;
	if (t >= 1) return b;
	return mix(a, b, t);
}
export function separation(s: Segment, t: Segment) {
	if (
		cross(s.a, s.b, t.a) * cross(s.a, s.b, t.b) < 0 &&
		cross(t.a, t.b, s.a) * cross(t.a, t.b, s.b) < 0
	)
		return 0;
	return Math.min(
		...[s.a, s.b].map((p) => distance(p, nearest(p, t))),
		...[t.a, t.b].map((p) => distance(p, nearest(p, s)))
	);
}
