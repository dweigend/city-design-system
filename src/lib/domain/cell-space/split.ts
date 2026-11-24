import type { Vec2 } from '../../core/geometry';

/** A convex or simple plan ring, counterclockwise. `keys` name its points symbolically, so two rings
 * that share a side name it alike without comparing coordinates. `edges[i]` is the parcel edge
 * that side i (point i to i + 1) lies on, or null inside the parcel. */
export type KeyedRing = Readonly<{
	id: string;
	corner: string;
	ear: string | null;
	keys: readonly string[];
	points: readonly Vec2[];
	edges: readonly (string | null)[];
}>;

const midpoint = ([ax, ay]: Vec2, [bx, by]: Vec2): Vec2 => [(ax + bx) / 2, (ay + by) / 2];
const midpointKey = (a: string, b: string) => `m(${[a, b].sort().join('|')})`;

// Exact arithmetic: vertex average of a ring.
function vertexAverage(points: readonly Vec2[]): Vec2 {
	const [x, y] = points.reduce(([sx, sy], [px, py]) => [sx + px, sy + py], [0, 0]);
	return [x / points.length, y / points.length];
}

/** Twice the signed area in square meters, measured from the first point so that far-off
 * coordinates keep their precision; positive when counterclockwise. */
export function doubleArea(points: readonly Vec2[]): number {
	const [ox, oy] = points[0];
	let sum = 0;
	for (let i = 1; i + 1 < points.length; i += 1) {
		const [ax, ay] = points[i];
		const [bx, by] = points[i + 1];
		sum += (ax - ox) * (by - oy) - (bx - ox) * (ay - oy);
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

/** Closed triangle test: a point on the diagonal blocks the ear. */
function touches(point: Vec2, [a, b, c]: readonly Vec2[]): boolean {
	return turn(a, b, point) >= 0 && turn(b, c, point) >= 0 && turn(c, a, point) >= 0;
}

function earAt(ring: KeyedRing, order: readonly number[], at: number): boolean {
	const n = order.length;
	const [p, q, r] = [order[(at + n - 1) % n], order[at], order[(at + 1) % n]];
	const triangle = [ring.points[p], ring.points[q], ring.points[r]];
	if (turn(triangle[0], triangle[1], triangle[2]) <= 0) return false;
	return order.every((k) => k === p || k === q || k === r || !touches(ring.points[k], triangle));
}

function clipEar(ring: KeyedRing, order: number[], at: number): KeyedRing {
	const n = order.length;
	const [p, q, r] = [order[(at + n - 1) % n], order[at], order[(at + 1) % n]];
	const consecutive = (a: number, b: number) => (a + 1) % ring.keys.length === b;
	const keys = [p, q, r].map((k) => ring.keys[k]);
	return {
		id: `${ring.id}/ear/${JSON.stringify(keys)}`,
		corner: ring.corner,
		ear: JSON.stringify(keys),
		keys,
		points: [p, q, r].map((k) => ring.points[k]),
		edges: [
			consecutive(p, q) ? ring.edges[p] : null,
			consecutive(q, r) ? ring.edges[q] : null,
			consecutive(r, p) ? ring.edges[r] : null
		]
	};
}

/** Splits a counterclockwise ring into convex parts: itself when convex, otherwise ear triangles
 * clipped at the lowest remaining corner that forms an ear with no other corner on or inside it. */
export function convexParts(ring: KeyedRing): readonly KeyedRing[] {
	if (convex(ring.points)) return [ring];
	const order = ring.keys.map((_, i) => i);
	const ears: KeyedRing[] = [];
	while (order.length > 2) {
		const at = order.findIndex((_, i) => earAt(ring, order, i));
		if (at < 0) throw new RangeError('Parcel ring cannot be triangulated');
		ears.push(clipEar(ring, order, at));
		order.splice(at, 1);
	}
	return ears;
}

/** One quad per corner of a convex ring: the corner, the next edge midpoint, the vertex average
 * and the previous edge midpoint (GRID-1). Child IDs are `<ring id>/child/<JSON [label]>`, with
 * the corner key as label at the first split and its role (corner, next, centre, previous) after. */
export function cornerQuads(ring: KeyedRing, first: boolean): readonly KeyedRing[] {
	const centre = vertexAverage(ring.points);
	const centreKey = `c(${ring.id})`;
	const n = ring.points.length;
	return ring.points.map((corner, i) => {
		const [j, h] = [(i + 1) % n, (i + n - 1) % n];
		const label = first ? ring.keys[i] : ['corner', 'next', 'centre', 'previous'][i];
		return {
			id: `${ring.id}/child/${JSON.stringify([label])}`,
			corner: first ? ring.keys[i] : ring.corner,
			ear: ring.ear,
			keys: [
				ring.keys[i],
				midpointKey(ring.keys[i], ring.keys[j]),
				centreKey,
				midpointKey(ring.keys[h], ring.keys[i])
			],
			points: [corner, midpoint(corner, ring.points[j]), centre, midpoint(ring.points[h], corner)],
			edges: [ring.edges[i], null, null, ring.edges[h]]
		};
	});
}
