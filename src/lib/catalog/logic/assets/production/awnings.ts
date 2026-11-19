import { actionFigure } from './activities/action-figure';
import { feet, hands, upright } from './activities/props';
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
	['single-bay', 'double-bay', 'triple-bay']
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
	const slots: Record<string, string> = { coat: 'fabric', skin: 'slats', gear: 'foot' };
	const arms = hands(0.38, 0.19, 1.04);
	arms[1] = [0.52, 0.16, 1.12 + 0.08 * (i % 2)];
	const vendor = actionFigure(
		{ hip: upright, lean: 0.11, feet: feet(0.15, -0.1), hands: arms },
		false,
		x,
		1.04,
		0.18,
		-Math.PI / 2
	);
	const customer = actionFigure(
		{ hip: upright, lean: 0.05, feet: feet(0.12, -0.16), hands: hands(0.37, 0.2, 1.08) },
		false,
		x + 0.2,
		-0.87,
		0.18,
		Math.PI / 2
	);
	return [...vendor, ...customer]
		.map((p) => ({ ...p, slot: slots[p.slot] }))
		.concat([
			panel(x, 0.2, 1.18, 0.62, 0.48, 0.11, 'foot'),
			cap([x - 0.13, 0.16, 1.29], 0.13, 0.16, 'fabric'),
			cap([x + 0.14, 0.23, 1.29], 0.15, 0.17, 'fabric')
		]);
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
