import { panel } from './objects/forms';
import { family, block, row, plate, circle, shell, slope } from './assembly';
import { drum } from './parts';
const asset = family('house-bodies', 'deck');
export const houseVolumes = [
	asset('plug-box', ['accent', 'glass'], [5, 4], (factor, v) => {
		const w = 4.8 * factor,
			h = 2.8,
			sill = 0.64;
		return [
			panel(0, 0, 0, w, 3.6, sill, 'accent'),
			panel(0, 0, h - 0.42, w, 3.6, 0.42, 'accent'),
			panel(0, 1.58, sill, w - 0.2, 0.36, h - 0.42 - sill, 'accent'),
			...[-1, 1].map((side) =>
				panel(side * (w / 2 - 0.18), 0, sill, 0.36, 3.4, h - 0.42 - sill, 'accent')
			),
			panel(0, -1.38, sill, w - 0.5, 0.14, h - 0.42 - sill, 'glass'),
			...row(2 + v, (t) =>
				panel(t * (w / 2 - 0.23), -1.52, sill, 0.13, 0.2, h - 0.42 - sill, 'accent')
			),
			panel(0, 0.58, sill, w - 0.75, 0.68, 0.43, 'accent')
		];
	}),
	asset('court-block', ['accent'], [8, 8], (factor) => [
		plate(
			[
				[-4, -4],
				[4, -4],
				[4, 4],
				[-4, 4]
			],
			0,
			3 * factor,
			'accent',
			[
				[-2, -2],
				[-2, 2],
				[2, 2],
				[2, -2]
			]
		)
	]),
	asset('ridge-house', ['accent', 'body'], [6, 5], (factor) => [
		block(0, 0, 0, 6, 4.8, 3 * factor, 'accent'),
		slope(-1.5, 0, 3 * factor, 3, 4.8, 2 * factor, Math.PI),
		slope(1.5, 0, 3 * factor, 3, 4.8, 2 * factor)
	]),
	asset('drum-house', ['accent', 'glass', 'body'], [6, 6], (factor) => [
		drum([0, 0, 0], 2.9, 2.2 * factor, 'accent'),
		drum([0, 0, 2.2 * factor], 2.86, 0.65, 'glass'),
		drum([0, 0, 2.2 * factor + 0.65], 3, 0.18)
	]),
	asset('terraced-body', ['accent', 'body', 'planting'], [8, 6], (factor, variant) => [
		...row(3 + variant, (_, i) =>
			panel(-i * 0.45, 0, i * 2, 8 - i * 0.95, 5.8, 2, i % 2 ? 'body' : 'accent')
		),
		block(-1.1, 0, (3 + variant) * 2, 2 * factor, 3, 0.15, 'planting')
	]),
	asset('offset-stack', ['body', 'accent'], [7, 5], (factor, variant) => [
		...row(3 + variant, (_, i) =>
			panel(((i % 2) - 0.5) * 1.4, 0, i * 2.5, 5.5 * factor, 4.8, 2.5, i % 2 ? 'accent' : 'body')
		)
	]),
	asset('gallery-bar', ['accent', 'body'], [10, 4], (factor, variant) => [
		block(0, 0.5, 0, 9.6 * factor, 2.8, 3, 'accent'),
		block(0, -1.4, 0, 10 * factor, 1, 0.22),
		...row(4 + variant, (t) => drum([t * 4.7 * factor, -1.76, 0.22], 0.15, 2.8)),
		block(0, -1.4, 3, 10 * factor, 1, 0.14)
	]),
	asset('tube-house', ['accent', 'body'], [4, 7], (factor) => [
		shell('vault', 0, 0, 0, 3.6, 6.6 * factor, 3, 0.22, 'accent'),
		block(0, 0, 0, 3.6, 6.6 * factor, 0.18)
	]),
	asset('setback-storey', ['body', 'accent', 'glass'], [7, 5], (factor) => [
		block(0, 0, 0, 6.8 * factor, 4.8, 0.26),
		panel(-0.45 * factor, 0.45, 0.26, 5.5 * factor, 3.7, 2.8, 'accent'),
		block(-0.45 * factor, -1.42, 1.1, 4.7 * factor, 0.08, 0.95, 'glass')
	]),
	asset('lantern-head', ['body', 'glass', 'highlight'], [6, 6], (factor, variant) => [
		drum([0, 0, 0], 1.25, 0.7),
		plate(circle(2.8, 6 + variant), 0.7, 0.32),
		plate(circle(2.58, 6 + variant), 1.02, 2.4 * factor, 'glass'),
		plate(circle(2.9, 6 + variant), 1.02 + 2.4 * factor, 0.25, 'highlight')
	]),
	asset('disc-tower', ['body'], [6, 6], (factor, variant) => [
		drum([0, 0, 0], 1, 2 * (3 + variant)),
		...row(3 + variant, (_, i) => drum([0, 0, i * 2 + 0.15], 2.8 * factor, 0.32))
	]),
	asset('service-core', ['body', 'glass'], [3, 4], (factor, variant) => [
		block(0, 0, 0, 2.8, 3.8, 9 * factor),
		...row(3 + variant, (t) =>
			block(0, -1.92, (t + 1) * 3.6 * factor + 0.4, 1.1, 0.08, 0.5, 'glass')
		)
	]),
	asset('twin-core', ['body'], [5, 3], (factor) => [
		block(-1.55, 0, 0, 1.4, 2.8, 10 * factor),
		block(1.55, 0, 0, 1.4, 2.8, 9 * factor),
		...row(3, (_, i) => block(0, 0, 1 + i * 3 * factor, 3.2, 1, 0.4))
	]),
	asset('stepped-gable-body', ['body', 'accent'], [6, 5], (factor, variant) => [
		block(0, 0, 0, 6, 4.8, 3),
		...row(2 + variant, (_, i) =>
			block(0, -2.22, 3 + i * 0.52 * factor, 5.4 - i * 1.25, 0.35, 0.52 * factor + 0.15, 'accent')
		)
	]),
	asset('corner-house', ['accent'], [7, 7], (factor) => [
		plate(
			[
				[-3, -3],
				[3, -3],
				[3, -0.5],
				[-0.5, -0.5],
				[-0.5, 3],
				[-3, 3]
			],
			0,
			3.6 * factor,
			'accent'
		)
	])
];
