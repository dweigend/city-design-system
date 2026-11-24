/** Module: Provides metric vectors, bounds and polygon measurements. */

import { defaults } from '../../../config/geometry';

/** World coordinates are in meters. X and Y span the ground plane. Z is height. */
export type Vec2 = readonly [x: number, y: number];

/** Three-dimensional world point or vector in the same coordinate system as Vec2. */
export type Vec3 = readonly [x: number, y: number, z: number];

/** Checks the exact arity and finite components of a dense coordinate tuple. */
export function isFiniteVector(value: unknown, arity: 2 | 3): boolean {
	if (!Array.isArray(value) || value.length !== arity) return false;
	for (let i = 0; i < arity; i++)
		if (!Object.hasOwn(value, i) || !Number.isFinite(value[i])) return false;
	return true;
}

/** Inclusive axis-aligned world bounds in meters, with min at or below max on each axis. */
export type Bounds3 = { readonly min: Vec3; readonly max: Vec3 };

/** Returns the detached sum of two meter vectors in meters. No mutation or input validation. */
export function sum([ax, ay, az]: Vec3, [bx, by, bz]: Vec3): Vec3 {
	return [ax + bx, ay + by, az + bz];
}

/** Returns the detached difference to − from in meters. No mutation or input validation. */
export function displacement([ax, ay, az]: Vec3, [bx, by, bz]: Vec3): Vec3 {
	return [bx - ax, by - ay, bz - az];
}

/** Returns a detached meter vector multiplied by a unitless factor. No mutation or input validation. */
export function scaled([x, y, z]: Vec3, factor: number): Vec3 {
	return [x * factor, y * factor, z * factor];
}

/** Returns the scalar dot product of two meter vectors in m². No mutation or input validation. */
export function dotProduct([ax, ay, az]: Vec3, [bx, by, bz]: Vec3): number {
	return ax * bx + ay * by + az * bz;
}

/** Returns the detached, right-handed cross product of two meter vectors in m². No mutation or validation. */
export function crossProduct([ax, ay, az]: Vec3, [bx, by, bz]: Vec3): Vec3 {
	return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

/** Returns a vector's Euclidean length in meters. No mutation or input validation. */
export function length(vector: Vec3): number {
	return Math.hypot(...vector);
}

/** Returns the Euclidean distance in meters between like-dimensional points. Does not mutate or validate. */
export function distance(from: Vec2, to: Vec2): number;
export function distance(from: Vec3, to: Vec3): number;
export function distance([ax, ay, az = 0]: Vec2 | Vec3, [bx, by, bz = 0]: Vec2 | Vec3): number {
	return Math.hypot(bx - ax, by - ay, bz - az);
}

/** Returns a detached, unitless direction from a finite meter vector. Throws RangeError at zero. No mutation. */
export function unitVector([x, y, z]: Vec3): Vec3 {
	const scale = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
	if (scale === 0) throw new RangeError('Cannot normalize a zero-length vector');
	const scaledVector: Vec3 = [x / scale, y / scale, z / scale];
	const magnitude = length(scaledVector);
	return [scaledVector[0] / magnitude, scaledVector[1] / magnitude, scaledVector[2] / magnitude];
}

/** Returns a detached linear point in meters at a unitless fraction (0 to 1 on the segment). No mutation or validation. */
export function interpolation(from: Vec3, to: Vec3, fraction: number): Vec3 {
	return sum(scaled(from, 1 - fraction), scaled(to, fraction));
}

/** Returns detached bounds of meter points, or undefined for an empty list. No mutation or validation. */
export function bounds(points: readonly Vec3[]): Bounds3 | undefined {
	if (points.length === 0) return undefined;
	const min: [number, number, number] = [Infinity, Infinity, Infinity];
	const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
	for (const [x, y, z] of points) {
		min[0] = Math.min(min[0], x);
		min[1] = Math.min(min[1], y);
		min[2] = Math.min(min[2], z);
		max[0] = Math.max(max[0], x);
		max[1] = Math.max(max[1], y);
		max[2] = Math.max(max[2], z);
	}
	return { min, max };
}

/** Returns the detached axis extents of valid bounds in meters. No mutation or input validation. */
export function size({ min, max }: Bounds3): Vec3 {
	return displacement(min, max);
}

/** Signed plan area in m² and area centroid in world meters, measured relative to the first
 * vertex. Z is ignored. Empty rings have no centroid; zero-area rings use the first vertex. */
export function measurePolygon(points: readonly (Vec2 | Vec3)[]) {
	if (!points.length) return { area: 0, centroid: undefined };
	const [ox, oy] = points[0];
	let twiceArea = 0;
	let xMoment = 0;
	let yMoment = 0;
	for (const [i, [x, y]] of points.entries()) {
		const [nextX, nextY] = points[(i + 1) % points.length];
		const ax = x - ox;
		const ay = y - oy;
		const bx = nextX - ox;
		const by = nextY - oy;
		const cross = ax * by - bx * ay;
		twiceArea += cross;
		xMoment += (ax + bx) * cross;
		yMoment += (ay + by) * cross;
	}
	const centroid: Vec2 = twiceArea
		? [ox + xMoment / (3 * twiceArea), oy + yMoment / (3 * twiceArea)]
		: [ox, oy];
	return { area: twiceArea / 2, centroid };
}

/** Tests convexity of a counterclockwise plan ring, allowing collinear points and arithmetic
 * roundoff in its corner turns. A ring with no positive area is rejected. */
// Exact arithmetic: at least three corners form a polygon.
export function isConvexCounterclockwise(points: readonly Vec2[]): boolean {
	if (points.length < 3) return false;
	let positive = false;
	for (const [i, [ax, ay]] of points.entries()) {
		const [bx, by] = points[(i + 1) % points.length];
		const [cx, cy] = points[(i + 2) % points.length];
		const turn = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
		if (turn < -defaults.convexTurnToleranceM2) return false;
		if (turn > 0) positive = true;
	}
	return positive;
}

/** Returns the counterclockwise convex hull of world XY points. Collinear boundary points
 * and duplicate points are omitted. An empty input has an empty hull. */
export function convexHull(points: readonly Vec2[]): readonly Vec2[] {
	const sorted = points.toSorted(([ax, ay], [bx, by]) => ax - bx || ay - by);
	if (sorted.length < 2) return sorted;
	const half = (ordered: readonly Vec2[]) => {
		const ring: Vec2[] = [];
		for (const point of ordered) {
			while (ring.length >= 2) {
				const [ax, ay] = ring[ring.length - 2];
				const [bx, by] = ring[ring.length - 1];
				if ((bx - ax) * (point[1] - ay) - (by - ay) * (point[0] - ax) > 0) break;
				ring.pop();
			}
			ring.push(point);
		}
		ring.pop();
		return ring;
	};
	const first = sorted[0];
	const last = sorted[sorted.length - 1];
	if (first[0] === last[0] && first[1] === last[1]) return [first];
	return [...half(sorted), ...half(sorted.reverse())];
}
