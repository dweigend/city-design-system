import {
	isConvexCounterclockwise,
	isSimpleRing,
	measurePolygon,
	type Vec2,
	type Vec3
} from '../../core/geometry';
import type { Shape } from '../../core/object';

type MeshShape = Extract<Shape, { kind: 'mesh' }>;
const coordinateCount = /* Exact arithmetic: packed points have three components. */ 3;

export function meshPoints({ positions }: MeshShape): Vec3[] {
	return Array.from({ length: positions.length / coordinateCount }, (_, index) => {
		const start = index * coordinateCount;
		return [positions[start], positions[start + 1], positions[start + 2]];
	});
}

export function extrudeRing(ring: readonly Vec2[], base: number, top: number): MeshShape {
	const count = ring.length;
	const positions = [base, top].flatMap((height) => ring.flatMap(([x, y]) => [x, y, height]));
	const { centroid } = measurePolygon(ring);
	if (!centroid) throw new RangeError('Expected a nonempty ring to extrude');
	// Start each cap fan at its center to retain edges split by collinear vertices.
	const bottomCenter = positions.length / coordinateCount;
	const topCenter = bottomCenter + 1;
	positions.push(...centroid, base, ...centroid, top);
	const indices: number[] = [];
	for (let i = 0; i < count; i++) {
		const next = (i + 1) % count;
		indices.push(bottomCenter, next, i, topCenter, i + count, next + count);
		if (base < top) indices.push(i, next, next + count, i, next + count, i + count);
	}
	return { kind: 'mesh', positions, indices };
}

// Exact arithmetic: centered box corners are half the planar side lengths from its axis.
function boxMesh({
	center: [x, y, z],
	size: [width, height, depth],
	rotation
}: Extract<Shape, { kind: 'box' }>) {
	const cos = Math.cos(rotation);
	const sin = Math.sin(rotation);
	const w = width / 2;
	const h = height / 2;
	const ring: Vec2[] = [
		[-w, -h],
		[w, -h],
		[w, h],
		[-w, h]
	];
	return extrudeRing(
		ring.map(([u, v]) => [x + u * cos - v * sin, y + u * sin + v * cos]),
		z - depth / 2,
		z + depth / 2
	);
}

export function localMesh(shape: Shape): MeshShape {
	if (shape.kind === 'mesh') return shape;
	if (shape.kind === 'box') return boxMesh(shape);
	const ring = measurePolygon(shape.polygon).area < 0 ? shape.polygon.toReversed() : shape.polygon;
	if (!isSimpleRing(ring) || !isConvexCounterclockwise(ring))
		throw new RangeError('Supply non-convex dock parts as indexed meshes');
	return extrudeRing(ring, shape.base, shape.top);
}
