import type { Vec3 } from '../../parametrik/types';
import { surface, drum, bulb, ring } from '../parts';
import { panel } from '../objects/forms';
import { cage, shell, pipe } from '../assembly';
import { series, tubeRing } from './series';

const block = series(
	'studio-sculptures',
	'deck',
	[2.5, 3.75, 5],
	['low-rise', 'middle-rise', 'high-rise']
);
const square = (w: number) => w;

const radialSteps = 48;
function boreSection(points: Vec3[], cx: number, pitch: number, w: number, d: number, h: number) {
	const rim = Math.min(pitch * 0.32, d * 0.31);
	for (let i = 0; i < radialSteps; i++) {
		const angle = (i * 2 * Math.PI) / radialSteps + Math.PI / 4,
			dx = Math.cos(angle),
			dy = Math.sin(angle),
			m = Math.max(Math.abs(dx), Math.abs(dy));
		for (const [x, y] of [
			[cx + ((dx / m) * pitch) / 2, ((dy / m) * d) / 2],
			[cx + dx * rim, dy * rim]
		]) {
			points.push([x, y, 0.2 + h * (0.16 + 0.84 * (0.5 - x / w))], [x, y, 0.2]);
		}
	}
}
function perimeter(a: Vec3, b: Vec3, w: number) {
	return (
		Math.abs(a[1] - b[1]) < 1e-8 ||
		(Math.abs(a[0] - b[0]) < 1e-8 && Math.abs(Math.abs(a[0]) - w / 2) < 1e-8)
	);
}
// The bore passes through the sloped top and underside; only the outer edges receive end caps.
function boredRamp(w: number, d: number, h: number, bores: number) {
	const points: Vec3[] = [],
		triangles: number[] = [];
	const face = (a: number, b: number, c: number, e: number) => triangles.push(a, b, c, a, c, e);
	for (let cell = 0; cell < bores; cell++) {
		const pitch = w / bores,
			cx = -w / 2 + pitch * (cell + 0.5),
			base = points.length;
		boreSection(points, cx, pitch, w, d, h);
		for (let i = 0; i < radialSteps; i++) {
			const j = base + i * 4,
				k = base + ((i + 1) % radialSteps) * 4;
			face(j, k, k + 2, j + 2);
			face(j + 1, j + 3, k + 3, k + 1);
			face(j + 2, k + 2, k + 3, j + 3);
			if (perimeter(points[j], points[k], w)) face(j, j + 1, k + 1, k);
		}
	}
	return { ...surface('punched'), kind: 'mesh' as const, points, triangles, lines: [] };
}
export const studioBlocks = [
	...block(
		'boring-jig-wedge',
		['brass', 'punched'],
		(w) => w * 0.8,
		(w, v) => [
			...[-1, 1].map((side) => panel(0, side * w * 0.31, 0, w, w * 0.12, 0.2, 'brass')),
			boredRamp(w - 0.14, w * 0.72, w * (0.52 + v * 0.18), v + 2)
		]
	),
	...block('barrel-axle', ['brass', 'ribbed', 'foot'], square, (w, v) => {
		const r = w * (0.24 + 0.05 * v),
			z = r + 0.16;
		return [
			panel(0, 0, 0, w * 0.82, w * 0.68, 0.24, 'foot'),
			ring([0, 0, z], r, r * 0.46, w * 0.7, 'ribbed'),
			ring([0, 0, z], r * 0.46, r * 0.23, w - 0.14, 'brass')
		];
	}),
	...block('cantilever-pearl', ['foot', 'brass', 'body'], square, (w, v) => {
		const z = w * (0.67 + 0.16 * v),
			r = w * 0.22;
		return [
			drum([-w * 0.18, 0, 0], w * 0.28, z, 'foot'),
			panel(0, 0, z, w * 0.89, w * 0.42, 0.22, 'brass'),
			bulb([w * 0.23, 0, z + 0.22 + r], r, 1, 'body')
		];
	}),
	...block('funnel-and-coil', ['foot', 'brass', 'body'], square, (w, v) => {
		const r = w * 0.29,
			h = w * (0.48 + 0.18 * v),
			turns = 2 + v;
		const points = Array.from({ length: turns * 20 + 1 }, (_, i): Vec3 => [
			r * Math.cos((i * Math.PI) / 10),
			r * Math.sin((i * Math.PI) / 10),
			0.21 + (i * h) / (turns * 20)
		]);
		return [
			drum([0, 0, 0], r + 0.17, 0.22, 'foot'),
			pipe(points, 0.13, 'brass'),
			shell('halfpipe', 0, 0, 0.21 + h, 2 * r + 0.24, 2 * r + 0.22, r, 0.2, 'body')
		];
	}),
	...block('cradle-lens', ['foot', 'glass', 'brass'], square, (w, v) => {
		const r = w * 0.32;
		return [
			shell('halfpipe', 0, 0, 0, w * 0.9, w * 0.73, r, 0.3, 'foot'),
			{ ...ring([0, 0, r + 0.08], r, r * 0.12, 0.32 + 0.21 * v, 'glass'), rotation: Math.PI / 2 },
			...[-1, 1].map((s) => drum([s * w * 0.33, 0, 0], 0.22, 0.22 + 0.13 * v, 'brass'))
		];
	}),
	...block('orbital-bookend', ['foot', 'body', 'brass'], square, (w, v) => {
		const r = w * (0.26 + v * 0.035),
			t = w * 0.075;
		return [
			panel(0, 0, 0, w * 0.88, w * 0.8, 0.24, 'foot'),
			tubeRing([0, 0, 0.24 + r + t], r, t, 'x', 'body'),
			bulb([0, 0, 0.24 + r + t + r * 0.48], r * 0.52, 1, 'brass')
		];
	}),
	...block('gallery-in-a-cage', ['frame', 'chips', 'body'], square, (w, v) => {
		const d = w - 0.45,
			h = d * (0.76 + 0.19 * v);
		return [
			{ ...cage(0, 0, 0, d, d, h, [1, 1, 1], false), slot: 'frame' },
			panel(0, d * 0.18, h * 0.42, d, d * 0.58, 0.22, 'chips'),
			shell('arch', 0, d * 0.18, h * 0.42 + 0.22, d * 0.66, d * 0.35, h * 0.36, 0.23, 'body')
		];
	})
];
