import type { Vec2, Vec3 } from '../../core/geometry';
import type { Shape } from '../../core/object';

/** An upright box: centre in meters, size along the side direction, across it and up, and the
 * side direction in radians about Z. */
export type Box = Readonly<{ center: Vec3; size: Vec3; rotation: number }>;

// Exact arithmetic: corner v(i, j, k) = i + 2j + 4k; quads wound outward, split into triangles.
const boxQuads = [
	[0, 2, 3, 1],
	[4, 5, 7, 6],
	[0, 1, 5, 4],
	[2, 6, 7, 3],
	[0, 4, 6, 2],
	[1, 3, 7, 5]
] as const;
// Exact arithmetic: eight corners per box.
const boxCorners = 8;

function corners({ center: [cx, cy, cz], size: [sx, sy, sz], rotation }: Box): number[] {
	const [cos, sin] = [Math.cos(rotation), Math.sin(rotation)];
	const positions: number[] = [];
	for (let corner = 0; corner < boxCorners; corner += 1) {
		const u = (corner & 1 ? 1 : -1) * (sx / 2);
		const v = (corner & 2 ? 1 : -1) * (sy / 2);
		const w = (corner & 4 ? 1 : -1) * (sz / 2);
		positions.push(cx + u * cos - v * sin, cy + u * sin + v * cos, cz + w);
	}
	return positions;
}

/** Joins boxes into one triangle mesh in box order, or undefined for none. */
export function boxMesh(boxes: readonly Box[]): Shape | undefined {
	if (!boxes.length) return undefined;
	const positions = boxes.flatMap(corners);
	const indices = boxes.flatMap((_, box) =>
		boxQuads.flatMap(([a, b, c, d]) =>
			[a, b, c, a, c, d].map((corner) => box * boxCorners + corner)
		)
	);
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

/** Moves each side of a counterclockwise quad outward by its own distance in meters and returns
 * the corners where consecutive moved sides meet. Parallel sides keep the moved corner. */
export function offsetQuad(quad: readonly Vec2[], outsets: readonly number[]): Vec2[] {
	const n = quad.length;
	return quad.map((_, i) => {
		const previous = side(quad, (i + n - 1) % n);
		const current = side(quad, i);
		const p: Vec2 = previous.at(1, outsets[(i + n - 1) % n]);
		const q: Vec2 = current.at(0, outsets[i]);
		const [d1x, d1y] = [previous.b[0] - previous.a[0], previous.b[1] - previous.a[1]];
		const [d2x, d2y] = [current.b[0] - current.a[0], current.b[1] - current.a[1]];
		const cross = d1x * d2y - d1y * d2x;
		if (Math.abs(cross) < Number.EPSILON * previous.length * current.length) return q;
		const t = ((q[0] - p[0]) * d2y - (q[1] - p[1]) * d2x) / cross;
		return [p[0] + d1x * t, p[1] + d1y * t];
	});
}
