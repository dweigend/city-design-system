import { defaults } from '../../../config/mesh';
import type { Vec3 } from '../geometry';
import type { Shape } from '../object';

// Exact arithmetic: six outward unit cube faces in the established vertex order.
const half = 0.5;
const faces: readonly (readonly Vec3[])[] = [
	[
		[half, half, half],
		[half, half, -half],
		[half, -half, half],
		[half, -half, -half]
	],
	[
		[-half, half, -half],
		[-half, half, half],
		[-half, -half, -half],
		[-half, -half, half]
	],
	[
		[-half, half, -half],
		[half, half, -half],
		[-half, half, half],
		[half, half, half]
	],
	[
		[-half, -half, half],
		[half, -half, half],
		[-half, -half, -half],
		[half, -half, -half]
	],
	[
		[-half, half, half],
		[half, half, half],
		[-half, -half, half],
		[half, -half, half]
	],
	[
		[half, half, -half],
		[-half, half, -half],
		[half, -half, -half],
		[-half, -half, -half]
	]
];

// Exact arithmetic: rotate the unit box's positive Z axis onto the span by the shortest rotation.
function axes(x: number, y: number, z: number) {
	const r = 1 + z;
	const q = r < defaults.opposedDirectionTolerance ? [0, -1, 0] : [-y, x, r];
	const inv = 1 / Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2]);
	const [u, v, w] = q.map((value) => value * inv);
	const u2 = u + u;
	const v2 = v + v;
	return { uu: u * u2, uv: u * v2, vv: v * v2, wu: w * u2, wv: w * v2 };
}

/** Generates a square-profile segment in world meters. */
// Exact arithmetic: four vertices form each cube face and two triangles index that face.
export function squareSegment(
	from: Vec3,
	to: Vec3,
	width: number
): Extract<Shape, { kind: 'mesh' }> {
	const [x, y, z] = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
	const length = Math.sqrt(x * x + y * y + z * z);
	if (!length) throw new RangeError('Expected a nonzero member span');
	const inverse = 1 / length;
	const { uu, uv, vv, wu, wv } = axes(x * inverse, y * inverse, z * inverse);
	const [a, b, c] = [from[0] + x * half, from[1] + y * half, from[2] + z * half];
	const positions = faces.flatMap((face) =>
		face.flatMap(([s, t, p]) => [
			(1 - vv) * width * s + uv * width * t + wv * length * p + a,
			uv * width * s + (1 - uu) * width * t + -wu * length * p + b,
			-wv * width * s + wu * width * t + (1 - (uu + vv)) * length * p + c
		])
	);
	const indices = faces.flatMap((face, i) => {
		const n = i * face.length;
		return [n, n + 2, n + 1, n + 2, n + 3, n + 1];
	});
	return { kind: 'mesh', positions, indices };
}
