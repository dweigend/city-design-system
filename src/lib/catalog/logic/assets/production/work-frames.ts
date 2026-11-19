import { cage, shell } from '../assembly';
import { panel } from '../objects/forms';
import { drum, ring, rod } from '../parts';
import { series } from './series';

const works = series(
	'scaffold-yards',
	'deck',
	[3.75, 5, 7.5],
	['one-lift', 'two-lift', 'three-lift']
);
function frame(x: number, y: number, z: number, w: number, d: number, h: number, lifts: number) {
	return { ...cage(x, y, z, w, d, h, [1, 1, lifts]), slot: 'frame' };
}
export const workFrames = [
	...works(
		'outboard-loading-stage',
		['frame', 'slats', 'ribbed'],
		() => 3.75,
		(w, v) => {
			const n = v + 1,
				h = 1.6 * n;
			return [
				frame(0, -0.5, 0, w - 0.52, 1.82, h, n),
				panel(0, 0, h, w, 3.5, 0.3, 'slats'),
				panel(0, -1.55, h + 0.3, w - 0.32, 0.18, 1.04, 'ribbed'),
				...[-1, 1].map((s) =>
					rod([s * (w / 2 - 0.32), 0.35, h - 1.14], [s * (w / 2 - 0.32), 1.58, h], 0.15, 'frame')
				)
			];
		}
	),
	...works(
		'courtyard-portal-hoist',
		['frame', 'brass', 'ribbed'],
		() => 3.75,
		(w, v) => {
			const n = v + 1,
				h = 2 + 1.25 * v;
			return [
				...[-1, 1].map((s) => frame(s * (w / 2 - 0.49), 0, 0, 0.65, 2.35, h, n)),
				frame(0, 0, h, w - 0.16, 1.1, 0.65, 1),
				ring([0, 0, h + 0.15], 0.5, 0.32, 0.3, 'brass'),
				rod([0, 0, 0.8], [0, 0, h], 0.065, 'brass'),
				panel(0, 0, 0.54, w * 0.43, 1.48, 0.32, 'ribbed')
			];
		}
	),
	...works(
		'switchback-service-decks',
		['frame', 'slats'],
		() => 3.75,
		(w, v) => {
			const n = v + 1,
				h = 1.7 * n;
			return [
				frame(0, 0, 0, w - 0.72, 2.62, h, n),
				...Array.from({ length: n }, (_, i) => {
					const z = (i + 1) * 1.7,
						side = i % 2 ? -1 : 1;
					return panel(side * 0.25, 0, z, w - 0.52, 3.24, 0.28, 'slats');
				})
			];
		}
	),
	...works(
		'launch-cradle-frame',
		['frame', 'foot', 'body'],
		() => 3.75,
		(w, v) => {
			const h = 0.75 + v * 0.52;
			return [
				...[-1, 1].map((s) => frame(s * w * 0.28, 0, 0, 0.83, 2.75, h, 1)),
				shell('halfpipe', 0, 0, h, w * 0.91, 2.9, 1.05, 0.32, 'body'),
				...[-1, 1].map((s) => panel(s * w * 0.28, 0, 0, 1, 3.16, 0.22, 'foot'))
			];
		}
	),
	...works(
		'scaffold-photo-blind',
		['frame', 'slats', 'punched'],
		() => 3.75,
		(w, v) => {
			const n = v + 1,
				h = n * 1.56;
			return [
				frame(0, 0, 0, w - 0.55, 2.63, h, n),
				panel(0, 0, h, w, 3.22, 0.26, 'slats'),
				panel(0, 1.4, h + 0.26, w - 0.32, 0.16, 0.92, 'punched'),
				panel(0, 1.4, h + 1.58, w - 0.32, 0.16, 0.44, 'punched'),
				...[-1, 1].map((s) => drum([s * (w / 2 - 0.32), 1.39, h + 0.26], 0.15, 1.73, 'frame'))
			];
		}
	),
	...works(
		'temporary-pipe-gantry',
		['frame', 'body', 'brass'],
		() => 3.75,
		(w, v) => {
			const n = v + 1,
				h = 2.5 + 0.48 * v;
			return [
				...[-1, 1].map((s) => frame(s * (w / 2 - 0.5), 0, 0, 0.66, 2.62, h, 2)),
				frame(0, 0, h, w - 0.24, 2.58, 0.65, 1),
				...Array.from({ length: n }, (_, i) => {
					const y = (i - (n - 1) / 2) * 0.68,
						z = h + 0.86;
					return [
						rod([-w / 2, y, z], [w / 2, y, z], 0.19, 'body'),
						...[-1, 1].map((t) => ring([t * (w / 2 - 0.38), y, z], 0.25, 0.16, 0.18, 'brass'))
					];
				}).flat()
			];
		}
	),
	...works(
		'survey-platform',
		['frame', 'slats', 'brass'],
		() => 3.75,
		(w, v) => {
			const n = v + 1,
				h = 1.5 * n;
			return [
				frame(0, 0, 0, w - 0.75, 2.52, h, n),
				panel(0, 0, h, w, 3.18, 0.26, 'slats'),
				...[-1, 1].map((s) => rod([s * 0.52, -0.35, h + 0.26], [0, 0, h + 1.25], 0.075, 'brass')),
				rod([0, 0.56, h + 0.26], [0, 0, h + 1.25], 0.075, 'brass'),
				ring([0, 0, h + 1.37], 0.22, 0.13, 0.82, 'brass')
			];
		}
	)
];
