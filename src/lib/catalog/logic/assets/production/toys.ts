import { cage, circle, plate, pipe } from '../assembly';
import { drum, bulb } from '../parts';
import { series, tubeRing } from './series';
import type { Vec3 } from '../../parametrik/types';

const toy = series('memphis-blocks', 'deck', [2.5, 3.75, 5], ['low', 'middle', 'tall']);
const square = (w: number) => w;
export const toys = [
	...toy('striped-spool', ['chips', 'ribbed'], square, (w, v) => {
		const r = w * 0.47,
			h = 0.4 + v * 0.32;
		return [
			drum([0, 0, 0], r, 0.3, 'chips'),
			drum([0, 0, 0.3], r * 0.72, h, 'ribbed'),
			drum([0, 0, h + 0.3], r, 0.3, 'chips')
		];
	}),
	...toy('fluted-chip-column', ['foot', 'brass'], square, (w, v) => {
		const r = w * 0.45,
			n = 3 + v,
			h = w * (0.7 + 0.2 * v),
			wall = plate(circle(r), 0.22, h, 'foot');
		const holes = circle(r * 0.64, n).map(([x, y]) =>
			circle(r * 0.17, 48)
				.map(([a, b]): [number, number] => [x + a, y + b])
				.reverse()
		);
		return [drum([0, 0, 0], r, 0.22, 'brass'), { ...wall, holes }];
	}),
	...toy('orb-cage', ['brass', 'body'], square, (w, v) => {
		const d = w - 0.4,
			h = d * (0.7 + v * 0.24),
			r = Math.min(d, h) * 0.38;
		return [
			{ ...cage(0, 0, 0, d, d, h, [v + 1, v + 1, 1], false), slot: 'brass' },
			bulb([0, 0, r + 0.08], r, 1, 'body')
		];
	}),
	...toy('coil-button', ['brass', 'foot'], square, (w, v) => {
		const turns = 2 + v,
			r = w * 0.36,
			h = w * (0.65 + v * 0.22);
		const points = Array.from({ length: turns * 48 + 1 }, (_, i): Vec3 => [
			r * Math.cos((i * Math.PI) / 24),
			r * Math.sin((i * Math.PI) / 24),
			0.3 + (h * i) / (turns * 48)
		]);
		return [
			drum([0, 0, 0], r + 0.16, 0.32, 'foot'),
			pipe(points, 0.15, 'brass'),
			drum([0, 0, h + 0.26], r + 0.16, 0.25, 'foot')
		];
	}),
	...toy('ring-abacus', ['brass', 'body'], square, (w, v) => {
		const r = w * 0.28,
			t = w * 0.1;
		return [
			drum([0, 0, 0], w * 0.46, 0.23, 'brass'),
			drum([0, 0, 0.2], 0.21, (v + 2) * 2 * t, 'brass'),
			...Array.from({ length: v + 2 }, (_, i) =>
				tubeRing([0, 0, 0.23 + t + i * 2 * t], r, t, 'z', 'body')
			)
		];
	}),
	...toy('gate-marble', ['foot', 'body'], square, (w, v) => {
		const r = w * 0.34,
			t = w * 0.11,
			h = r + t;
		return [
			tubeRing([0, 0, h], r, t, 'x', 'foot'),
			bulb([0, 0, h], r * (0.38 + 0.12 * v), 1, 'body'),
			drum([0, 0, 0], r * 0.8, h - r * (0.38 + 0.12 * v), 'body')
		];
	}),
	...toy('perforated-cheese', ['foot', 'brass'], square, (w, v) => {
		const r = w / 2 - 0.12,
			outer: [number, number][] = [
				[-r, -r],
				[r, -r],
				[-r, r]
			];
		const holes = circle(r * (0.22 + v * 0.035), 24)
			.map(([x, y]): [number, number] => [x - r * 0.35, y - r * 0.35])
			.reverse();
		return [
			plate(outer, 0, 0.22, 'brass', holes),
			plate(outer, 0.22, w * (0.4 + v * 0.22), 'foot', holes)
		];
	})
];
