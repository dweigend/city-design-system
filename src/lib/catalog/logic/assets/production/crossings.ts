import { actionFigure } from './activities/action-figure';
import { block, shell } from '../assembly';
import { drum, ring, rod } from '../parts';
import { panel } from '../objects/forms';
import { series } from './series';

const crossing = series(
	'transit-crossings',
	'deck',
	[5, 7.5, 10],
	['low-pier', 'viaduct', 'high-line'],
	'foot'
);
function pier(x: number, h: number) {
	return [
		drum([x, 0, 0], 0.37, h * 0.58, 'foot'),
		...[-1, 1].map((s) => rod([x, 0, h * 0.52], [x, s * 0.96, h], 0.21, 'foot'))
	];
}
function travellers(w: number, y: number, z: number) {
	const n = Math.floor(w / 1.65);
	return Array.from({ length: n }, (_, i) =>
		actionFigure(i % 2 ? 'walk' : 'stand', [(i - (n - 1) / 2) * 0.94, y + (i % 2) * 0.2, z], {
			heading: i * 1.85,
			slot: 'foot',
			sample: (i + 1) / (n + 1)
		})
	).flat();
}
function bridge(kind: 'open' | 'screen' | 'canopy' | 'arcade') {
	return crossing(
		'y-pier-' + kind + '-skywalk',
		['foot', 'slats', kind === 'screen' ? 'glass' : 'body'],
		() => 3.3,
		(w, v) => {
			const h = 1.85 + 1.1 * v,
				z = h + 0.3,
				roof = kind === 'canopy' || kind === 'arcade';
			return [
				...[-1, 1].flatMap((s) => pier(s * w * 0.31, h)),
				panel(0, 0, h, w, 2.9, 0.3, 'slats'),
				...travellers(w, 0, z),
				...[-1, 1].map((s) =>
					panel(
						0,
						s * 1.33,
						z,
						w,
						0.2,
						kind === 'screen' ? 1.72 : 0.98,
						kind === 'screen' ? 'glass' : 'body'
					)
				),
				...(roof
					? Array.from({ length: kind === 'arcade' ? 3 : 2 }, (_, i) => ({
							...shell(
								'vault',
								0,
								0,
								z,
								2.8,
								kind === 'arcade' ? 0.5 : w * 0.44,
								2.4,
								0.22,
								'body'
							),
							position: [
								(i / (kind === 'arcade' ? 2 : 1) - 0.5) * w * (kind === 'arcade' ? 0.85 : 0.48),
								0,
								z
							] as [number, number, number],
							rotation: Math.PI / 2
						}))
					: [])
			];
		}
	);
}
function tube(stop: 'through' | 'platform' | 'exchange') {
	return crossing(
		'transit-' + stop + '-tube',
		['foot', 'body', 'glass'],
		() => (stop === 'through' ? 3.8 : 6.75),
		(w, v) => {
			const h = 1.6 + v,
				z = h + 1.44,
				r = 1.45;
			return [
				...[-1, 1].flatMap((s) => pier(s * w * 0.32, h)),
				...(stop === 'through'
					? [ring([0, 0, z], r, r - 0.12, w, 'glass')]
					: [-1, 1].map((s) => ring([s * w * 0.34, 0, z], r, r - 0.12, w * 0.32, 'glass'))),
				...(stop === 'through' ? [-1, 0, 1] : [-1, 1]).map((s) =>
					ring([s * (w / 2 - 0.11), 0, z], r + 0.1, r - 0.13, 0.22, 'body')
				),
				panel(0, 0, h + 0.39, w, 1.9, 0.22, 'body'),
				...travellers(w, stop === 'through' ? 0 : 2.02, h + 0.61),
				...(stop === 'through' ? [] : [block(0, 2.02, h, w, 2.24, 0.61, 'foot')]),
				...(stop === 'exchange' ? [block(0, -2.02, h, w, 2.24, 0.61, 'foot')] : [])
			];
		}
	);
}
export const crossings = [
	...bridge('open'),
	...bridge('screen'),
	...bridge('canopy'),
	...bridge('arcade'),
	...tube('through'),
	...tube('platform'),
	...tube('exchange')
];
