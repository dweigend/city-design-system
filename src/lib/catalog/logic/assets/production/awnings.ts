import { actionFigure } from './activities/action-figure';
import { shell } from '../assembly';
import { drum, cap } from '../parts';
import { panel } from '../objects/forms';
import { sail } from '../objects/fabric';
import { series } from './series';
import type { ObjectGeometry } from '../object-geometry';

const stand = series(
	'market-canopies',
	'deck',
	[3.75, 5, 7.5],
	['single-bay', 'double-bay', 'triple-bay'],
	'slats'
);
type Roof = 'awning' | 'vault' | 'lentil' | 'butterfly' | 'ribbon' | 'sawtooth' | 'scallop';
function canopy(roof: Roof, x: number, w: number, d: number, h: number): ObjectGeometry[] {
	switch (roof) {
		case 'lentil':
			return [cap([x, 0, h], Math.min(w, d) * 0.47, 0.58, 'fabric')];
		case 'vault':
			return [shell('vault', x, 0, h, w, d, 0.78, 0.16, 'fabric')];
		case 'butterfly':
			return [shell('halfpipe', x, 0, h, w, d, 0.65, 0.16, 'fabric')];
		case 'scallop':
			return [
				shell('vault', x, 0, h, w, d, 0.32, 0.2, 'fabric'),
				panel(x, -d / 2 + 0.12, h - 0.24, w, 0.25, 0.25, 'fabric')
			];
		case 'sawtooth':
			return [
				sail(
					[
						[x - w / 2, -d / 2, h],
						[x + w / 2, -d / 2, h + 0.7],
						[x + w / 2, d / 2, h + 0.7],
						[x - w / 2, d / 2, h]
					],
					0.08
				)
			];
		case 'ribbon':
			return [
				sail(
					[
						[x - w / 2, -d / 2, h],
						[x + w / 2, -d / 2, h + 0.5],
						[x + w / 2, d / 2, h],
						[x - w / 2, d / 2, h + 0.5]
					],
					0.14
				)
			];
		case 'awning':
			return [
				sail(
					[
						[x - w / 2, -d / 2, h],
						[x + w / 2, -d / 2, h],
						[x + w / 2, d / 2, h + 0.6],
						[x - w / 2, d / 2, h + 0.6]
					],
					0.08
				)
			];
	}
}
function tradeBay(x: number, i: number) {
	return [
		...actionFigure('stand', [x, 1.03, 0.18], { slot: 'slats', heading: -1.5, sample: i / 3 }),
		...actionFigure('lean', [x + 0.12, -0.84, 0.18], {
			slot: 'slats',
			heading: 1.5,
			sample: 1 - i / 3
		})
	];
}
function booth(roof: Roof) {
	return stand(
		roof + '-vendor-booth',
		['foot', 'slats', 'fabric'],
		() => 3,
		(w, v) => {
			const n = v + 1,
				h = 2.5;
			return [
				panel(0, 0, 0, w - 0.22, 2.7, 0.18, 'foot'),
				panel(0, 0.24, 0.18, w - 0.75, 0.92, 0.84, 'slats'),
				panel(0, 0.14, 1.02, w - 0.48, 1.22, 0.16, 'slats'),
				...Array.from({ length: n }, (_, i) =>
					tradeBay(((i + 0.5) / n - 0.5) * (w - 0.75), i)
				).flat(),
				...[-1, 1].flatMap((s) =>
					[-1, 1].map((t) => drum([s * (w / 2 - 0.23), t * 1.15, 0.18], 0.16, h - 0.13, 'slats'))
				),
				...[-1, 1].map((t) => panel(0, t * 1.15, h - 0.22, w, 0.32, 0.32, 'slats')),
				...Array.from({ length: n }, (_, i) =>
					panel(((i + 0.5) / n - 0.5) * w, 0, h - 0.18, 0.32, 2.6, 0.3, 'slats')
				),
				...Array.from({ length: n }, (_, i) =>
					canopy(roof, ((i + 0.5) / n - 0.5) * w, w / n, 2.95, h + 0.09)
				).flat()
			];
		}
	);
}
export const awnings = (
	['awning', 'vault', 'lentil', 'butterfly', 'ribbon', 'sawtooth', 'scallop'] as const
).flatMap(booth);
