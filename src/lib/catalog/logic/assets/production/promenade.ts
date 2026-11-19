import { circle, pipe, shell } from '../assembly';
import { panel } from '../objects/forms';
import { cap, drum, ring } from '../parts';
import { series } from './series';

const furniture = series(
	'promenade-furniture',
	'deck',
	[2.5, 3.75, 5],
	['one-place', 'two-place', 'three-place']
);
export const promenade = [
	...furniture(
		'switchback-sociable',
		['foot', 'slats', 'body'],
		() => 1.75,
		(w, v) => {
			const places = v + 1,
				bay = (w - 0.24) / places;
			return [
				panel(0, 0, 0, w - 0.3, 0.64, 0.38, 'foot'),
				...Array.from({ length: places }, (_, i) => {
					const x = (i - (places - 1) / 2) * bay,
						side = i % 2 ? -1 : 1;
					return [
						panel(x, 0, 0.38, bay - 0.05, 1.12, 0.12, 'slats'),
						panel(x, side * 0.45, 0.5, bay - 0.08, 0.18, 0.43, 'body')
					];
				}).flat()
			];
		}
	),
	...furniture(
		'reading-carrel-bar',
		['foot', 'chips', 'brass'],
		() => 1.6,
		(w, v) => {
			const n = v + 1,
				bay = (w - 0.18) / n;
			return [
				panel(0, 0.28, 0, w - 0.52, 0.48, 0.74, 'foot'),
				panel(0, 0, 0.74, w - 0.1, 1.32, 0.12, 'chips'),
				...Array.from({ length: n + 1 }, (_, i) =>
					panel((i - n / 2) * bay, 0.17, 0.86, 0.14, 0.94, 0.34, 'brass')
				)
			];
		}
	),
	...furniture(
		'drum-lamp-cornice',
		['foot', 'brass', 'glass'],
		() => 1.75,
		(w, v) => {
			const n = v + 1,
				h = 2.32;
			return [
				panel(0, 0, 0, w - 0.25, 0.7, 0.28, 'foot'),
				...[-1, 1].map((s) => drum([s * (w / 2 - 0.32), 0, 0.28], 0.17, h - 0.28, 'brass')),
				panel(0, 0, h, w, 0.38, 0.3, 'brass'),
				...Array.from({ length: n }, (_, i) =>
					cap(
						[((i + 0.5) / n - 0.5) * (w - 0.6), 0, h + 0.28],
						Math.min(0.54, ((w - 0.5) / n) * 0.4),
						0.48,
						'glass'
					)
				)
			];
		}
	),
	...furniture(
		'wheel-service-cradle',
		['foot', 'brass', 'ribbed'],
		() => 2,
		(w, v) => {
			const n = v + 1;
			return [
				panel(0, 0, 0, w, 1.8, 0.18, 'foot'),
				...Array.from({ length: n }, (_, i) => {
					const x = ((i + 0.5) / n - 0.5) * (w - 0.4);
					return [
						ring([x, 0, 0.78], 0.62, 0.46, 0.23, 'brass'),
						panel(x, 0, 0.18, 0.38, 0.86, 0.33, 'ribbed')
					];
				}).flat()
			];
		}
	),
	...furniture(
		'refill-channel',
		['foot', 'liquid', 'brass'],
		() => 1.6,
		(w, v) => {
			const n = v + 1;
			return [
				panel(0, 0, 0, w - 0.18, 1.24, 0.72, 'foot'),
				panel(0, 0, 0.72, w - 0.36, 0.87, 0.06, 'liquid'),
				...Array.from({ length: n }, (_, i) => {
					const x = ((i + 0.5) / n - 0.5) * (w - 0.45);
					return pipe(
						[
							[x, 0.52, 0.7],
							[x, 0.52, 1.24],
							[x, 0.22, 1.28],
							[x, 0.1, 1.12]
						],
						0.075,
						'brass'
					);
				})
			];
		}
	),
	...furniture(
		'checker-court-table',
		['foot', 'slats', 'body'],
		() => 2.5,
		(w, v) => {
			const n = v + 1;
			return [
				panel(0, 0, 0, w - 0.56, 0.44, 0.73, 'foot'),
				panel(0, 0, 0.73, w, 1.04, 0.12, 'slats'),
				...Array.from({ length: n }, (_, i) => {
					const x = ((i + 0.5) / n - 0.5) * w,
						r = Math.min(0.29, (w / n) * 0.27);
					return [
						...[-1, 1].map((s) => drum([x, s * 0.92, 0], r, 0.43, 'body')),
						...circle(0.15, 4).map(([a, b]) => drum([x + a, b, 0.85], 0.06, 0.055, 'body'))
					];
				}).flat()
			];
		}
	),
	...furniture(
		'rain-pocket-seat',
		['foot', 'slats', 'ribbed'],
		() => 2.25,
		(w, v) => {
			const n = v + 1;
			return [
				panel(0, 0, 0, w, 1.92, 0.18, 'foot'),
				panel(0, 0.5, 0.18, w - 0.38, 0.61, 0.29, 'slats'),
				...Array.from({ length: n }, (_, i) => {
					const bay = w / n,
						x = ((i + 0.5) / n - 0.5) * w;
					return [
						shell('vault', x, 0, 1.67, bay - 0.04, 1.95, 0.54, 0.15, 'ribbed'),
						...[-1, 1].map((s) =>
							drum([x + s * (bay / 2 - 0.17), 0.72, 0.18], 0.15, 1.51, 'ribbed')
						)
					];
				}).flat()
			];
		}
	)
];
