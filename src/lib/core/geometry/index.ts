/** World coordinates are in meters. X and Y span the ground plane. Z is height. */
export type Vec2 = readonly [x: number, y: number];

/** Three-dimensional world point or vector in the same coordinate system as Vec2. */
export type Vec3 = readonly [x: number, y: number, z: number];

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
