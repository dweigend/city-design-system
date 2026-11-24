import type { Vec2 } from '../geometry';

export type Bounds = Readonly<{ min: Vec2; max: Vec2 }>;

export function bounds(points: readonly Vec2[]): Bounds {
	let left = Infinity;
	let bottom = Infinity;
	let right = -Infinity;
	let top = -Infinity;
	for (const [x, y] of points) {
		left = Math.min(left, x);
		bottom = Math.min(bottom, y);
		right = Math.max(right, x);
		top = Math.max(top, y);
	}
	return { min: [left, bottom], max: [right, top] };
}

export function overlaps(a: Bounds, b: Bounds, margin: number) {
	return (
		a.min[0] <= b.max[0] + margin &&
		b.min[0] <= a.max[0] + margin &&
		a.min[1] <= b.max[1] + margin &&
		b.min[1] <= a.max[1] + margin
	);
}

function distanceToEdge([x, y]: Vec2, [ax, ay]: Vec2, [bx, by]: Vec2) {
	const dx = bx - ax;
	const dy = by - ay;
	const length = dx * dx + dy * dy;
	const t = length ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length)) : 0;
	return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

export function contains(ring: readonly Vec2[], point: Vec2, margin: number) {
	const [x, y] = point;
	let inside = false;
	for (const [i, a] of ring.entries()) {
		const b = ring[(i + 1) % ring.length];
		if (distanceToEdge(point, a, b) <= margin) return true;
		if (a[1] > y !== b[1] > y && x < a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]))
			inside = !inside;
	}
	return inside;
}

// Exact arithmetic: returns the intersection parameter on a closed XY segment.
function crossing([x, y]: Vec2, [u, v]: Vec2, [ax, ay]: Vec2, [bx, by]: Vec2) {
	const dx = u - x;
	const dy = v - y;
	const ex = bx - ax;
	const ey = by - ay;
	const determinant = dx * ey - dy * ex;
	if (!determinant) {
		const length = dx * dx + dy * dy;
		if (!length || (ax - x) * dy !== (ay - y) * dx) return Infinity;
		const a = ((ax - x) * dx + (ay - y) * dy) / length;
		const b = ((bx - x) * dx + (by - y) * dy) / length;
		const first = Math.max(0, Math.min(a, b));
		return first <= Math.min(1, Math.max(a, b)) ? first : Infinity;
	}
	const t = ((ax - x) * ey - (ay - y) * ex) / determinant;
	const s = ((ax - x) * dy - (ay - y) * dx) / determinant;
	return t >= 0 && t <= 1 && s >= 0 && s <= 1 ? t : Infinity;
}

export function entry(ring: readonly Vec2[], from: Vec2, to: Vec2, margin: number) {
	if (contains(ring, from, margin)) return 0;
	let first = Infinity;
	for (const [i, a] of ring.entries())
		first = Math.min(first, crossing(from, to, a, ring[(i + 1) % ring.length]));
	return first < Infinity ? first : contains(ring, to, margin) ? 1 : Infinity;
}
