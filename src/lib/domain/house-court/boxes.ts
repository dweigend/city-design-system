import type { Vec2, Vec3 } from '../../core/geometry';
import type { Shape } from '../../core/object';

/** An upright box: centre in meters, size along the side direction, across it and up, and the
 * side direction in radians about Z. */
export type Box = Readonly<{ center: Vec3; size: Vec3; rotation: number }>;

// Exact arithmetic: corner v(i, j, k) = i + 2j + 4k; quads wound outward, split into triangles.
const boxQuads = /* Exact arithmetic: four vertex indices per box face in outward winding. */ [
	[0, 2, 3, 1],
	[4, 5, 7, 6],
	[0, 1, 5, 4],
	[2, 6, 7, 3],
	[0, 4, 6, 2],
	[1, 3, 7, 5]
] as const;
// Exact arithmetic: eight corners per box.
const boxCorners = /* Exact arithmetic: corners of a box. */ 8;

function corners({ center: [cx, cy, cz], size: [sx, sy, sz], rotation }: Box): number[] {
	const [cos, sin] = [Math.cos(rotation), Math.sin(rotation)];
	const positions: number[] = [];
	for (let corner = 0; corner < boxCorners; corner += 1) {
		const u =
			(corner & /* Exact arithmetic: bit mask for the X corner bit. */ 1 ? 1 : -1) * (sx / 2);
		const v =
			(corner & /* Exact arithmetic: bit mask for the Y corner bit. */ 2 ? 1 : -1) * (sy / 2);
		const w =
			(corner & /* Exact arithmetic: bit mask for the Z corner bit. */ 4 ? 1 : -1) * (sz / 2);
		positions.push(cx + u * cos - v * sin, cy + u * sin + v * cos, cz + w);
	}
	return positions;
}

/** Joins a nonempty list of boxes into one triangle mesh in box order. */
export function boxMesh(boxes: readonly Box[]): Shape {
	const positions = boxes.flatMap(corners);
	const indices = boxes.flatMap((_, box) =>
		boxQuads.flatMap(([a, b, c, d]) =>
			[a, b, c, a, c, d].map((corner) => box * boxCorners + corner)
		)
	);
	return { kind: 'mesh', positions, indices };
}

/** Joins a nonempty list of convex planar polygons, each wound outward, into one mesh. */
export function faceMesh(faces: readonly (readonly Vec3[])[]): Shape {
	const positions: number[] = [];
	const indices: number[] = [];
	for (const face of faces) {
		const first = positions.length / 3;
		for (const point of face) positions.push(...point);
		for (let k = 1; k + 1 < face.length; k += 1) indices.push(first, first + k, first + k + 1);
	}
	return { kind: 'mesh', positions, indices };
}

/** A side of a counterclockwise quad: endpoints, length, direction and outward unit normal. */
export function side(quad: readonly Vec2[], i: number) {
	const [a, b] = [quad[i], quad[(i + 1) % quad.length]];
	const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
	const length = Math.hypot(dx, dy);
	return {
		a,
		b,
		length,
		rotation: Math.atan2(dy, dx),
		normal: [dy / length, -dx / length] as Vec2,
		at: (t: number, out: number): Vec2 => [
			a[0] + dx * t + (dy / length) * out,
			a[1] + dy * t - (dx / length) * out
		]
	};
}
