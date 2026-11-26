import {
	crossProduct,
	displacement,
	dotProduct,
	length,
	scaled,
	sum,
	unitVector,
	type Bounds3,
	type Vec3
} from '../../core/geometry';

export type OrientedBox = Readonly<{
	center: Vec3;
	axes: readonly [Vec3, Vec3, Vec3];
	halfExtents: Vec3;
}>;

const worldAxes: readonly [Vec3, Vec3, Vec3] = [
	/* Exact arithmetic: orthonormal world X basis vector. */ [1, 0, 0],
	/* Exact arithmetic: orthonormal world Y basis vector. */ [0, 1, 0],
	/* Exact arithmetic: orthonormal world Z basis vector. */ [0, 0, 1]
];
const half = /* Exact arithmetic: box half-extent divisor. */ 2;

export function aabbOverlaps(a: Bounds3, b: Bounds3, toleranceM: number): boolean {
	return a.min.every(
		(value, axis) => Math.min(a.max[axis], b.max[axis]) - Math.max(value, b.min[axis]) > toleranceM
	);
}

export function aabbToOrientedBox({ min, max }: Bounds3): OrientedBox {
	return {
		center: [(min[0] + max[0]) / half, (min[1] + max[1]) / half, (min[2] + max[2]) / half],
		axes: worldAxes,
		halfExtents: [(max[0] - min[0]) / half, (max[1] - min[1]) / half, (max[2] - min[2]) / half]
	};
}

export function createOrientedBox(
	origin: Vec3,
	axes: readonly [Vec3, Vec3, Vec3],
	points: readonly Vec3[]
): OrientedBox {
	let minX = Infinity;
	let minY = Infinity;
	let minZ = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	let maxZ = -Infinity;
	for (const [x, y, z] of points) {
		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (z < minZ) minZ = z;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
		if (z > maxZ) maxZ = z;
	}
	const mid: Vec3 = [(minX + maxX) / half, (minY + maxY) / half, (minZ + maxZ) / half];
	const offset = sum(
		sum(scaled(axes[0], mid[0]), scaled(axes[1], mid[1])),
		scaled(axes[2], mid[2])
	);
	return {
		center: sum(origin, offset),
		axes,
		halfExtents: [(maxX - minX) / half, (maxY - minY) / half, (maxZ - minZ) / half]
	};
}

function projectRadius({ axes, halfExtents }: OrientedBox, axis: Vec3): number {
	return (
		halfExtents[0] * Math.abs(dotProduct(axes[0], axis)) +
		halfExtents[1] * Math.abs(dotProduct(axes[1], axis)) +
		halfExtents[2] * Math.abs(dotProduct(axes[2], axis))
	);
}

export function orientedBoxesOverlap(a: OrientedBox, b: OrientedBox, toleranceM: number): boolean {
	const delta = displacement(a.center, b.center);
	const candidates: Vec3[] = [...a.axes, ...b.axes];
	for (const axisA of a.axes) {
		for (const axisB of b.axes) {
			const edge = crossProduct(axisA, axisB);
			if (length(edge) > toleranceM) candidates.push(unitVector(edge));
		}
	}
	for (const axis of candidates) {
		const overlap =
			projectRadius(a, axis) + projectRadius(b, axis) - Math.abs(dotProduct(delta, axis));
		if (overlap <= toleranceM) return false;
	}
	return true;
}
