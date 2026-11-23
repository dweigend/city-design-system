import type { Vec2 } from '../../core/geometry';

/** A plan polygon with stable corner keys, counterclockwise. */
export type KeyedRing = Readonly<{ id: string; keys: readonly string[]; points: readonly Vec2[] }>;

const midpoint = ([ax, ay]: Vec2, [bx, by]: Vec2): Vec2 => [(ax + bx) / 2, (ay + by) / 2];

function vertexAverage(points: readonly Vec2[]): Vec2 {
	const [x, y] = points.reduce(([sx, sy], [px, py]) => [sx + px, sy + py], [0, 0]);
	return [x / points.length, y / points.length];
}

/** Twice the signed area of a plan ring in square meters; positive when counterclockwise. */
export function doubleArea(points: readonly Vec2[]): number {
	let sum = 0;
	for (let i = 0; i < points.length; i += 1) {
		const [ax, ay] = points[i];
		const [bx, by] = points[(i + 1) % points.length];
		sum += ax * by - bx * ay;
	}
	return sum;
}

function turn(a: Vec2, b: Vec2, c: Vec2): number {
	return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function convex(points: readonly Vec2[]): boolean {
	return points.every((point, i) => {
		const previous = points[(i + points.length - 1) % points.length];
		return turn(previous, point, points[(i + 1) % points.length]) >= 0;
	});
}

function inside(point: Vec2, [a, b, c]: readonly Vec2[]): boolean {
	return turn(a, b, point) > 0 && turn(b, c, point) > 0 && turn(c, a, point) > 0;
}

function earAt(points: readonly Vec2[], order: readonly number[], at: number): boolean {
	const n = order.length;
	const [p, q, r] = [order[(at + n - 1) % n], order[at], order[(at + 1) % n]];
	const triangle = [points[p], points[q], points[r]];
	if (turn(triangle[0], triangle[1], triangle[2]) <= 0) return false;
	return order.every((k) => k === p || k === q || k === r || !inside(points[k], triangle));
}

/** Splits a counterclockwise ring into convex parts: itself when convex, otherwise ear triangles
 * clipped at the lowest remaining corner index that forms an ear (stable ties). */
export function convexParts(ring: KeyedRing): readonly KeyedRing[] {
	if (convex(ring.points)) return [ring];
	const order = ring.keys.map((_, i) => i);
	const ears: KeyedRing[] = [];
	while (order.length > 2) {
		const at = order.findIndex((_, i) => earAt(ring.points, order, i));
		if (at < 0) throw new RangeError('Parcel ring cannot be triangulated');
		const n = order.length;
		const corners = [order[(at + n - 1) % n], order[at], order[(at + 1) % n]];
		ears.push({
			id: `${ring.id}/ear/${ears.length}`,
			keys: corners.map((k) => ring.keys[k]),
			points: corners.map((k) => ring.points[k])
		});
		order.splice(at, 1);
	}
	return ears;
}

/** One quad per corner of a convex ring: the corner, the next edge midpoint, the vertex average
 * and the previous edge midpoint (GRID-1). Child IDs are `<ring id>/child/<JSON [corner key]>`. */
export function cornerQuads(ring: KeyedRing): readonly KeyedRing[] {
	const centre = vertexAverage(ring.points);
	const n = ring.points.length;
	return ring.points.map((corner, i) => {
		const next = ring.points[(i + 1) % n];
		const previous = ring.points[(i + n - 1) % n];
		return {
			id: `${ring.id}/child/${JSON.stringify([ring.keys[i]])}`,
			keys: ['corner', 'next', 'centre', 'previous'],
			points: [corner, midpoint(corner, next), centre, midpoint(previous, corner)]
		};
	});
}
