import { pleatedGlass } from './pleat-art';
import { suggestions } from './suggestions';
import { family, row } from '../assembly';
import { panel, post, rail, bow, eye, bead, band, collar } from './forms';
import { vessel } from '../pottery';

const asset = family('public-art', 'deck', suggestions);
const glassArt = family('public-art', 'deck', { ...suggestions, body: suggestions.screen });
const stoneArt = family('public-art', 'deck', {
	...suggestions,
	body: suggestions.foot,
	frame: suggestions.slats
});
export const publicArt = [
	asset('counterweight-orbit', ['foot', 'shell', 'body'], [2.8, 2.8], (span) => [
		post(0, 0, 0, 0.65, 0.22, 'foot'),
		eye(0, 0, 0.22 + 0.98 * span, 0.98 * span, 0.13, 0.21, 'shell'),
		bead(0.12, 0.68 * span, 0.22 + 1.67 * span, 0.32, 0.85, 'body')
	]),
	asset('stacked-crescents', ['foot', 'body'], [3, 3], (_span, variant) => [
		post(0, 0, 0, 1.24, 0.16, 'foot'),
		...row(2 + variant, (_, i) =>
			band(1.15 - i * 0.13, 0.26, 0.16 + i * 0.41, 0.41, 2.4 + i * 0.68, 'body')
		)
	]),
	asset('hinge-stele', ['foot', 'body', 'shell', 'slats'], [2.9, 1.5], (span) => [
		panel(0, 0, 0, 2.5 * span, 0.97, 0.19, 'foot'),
		...row(2, (t) => panel(t * 0.78 * span, 0, 0.19, 0.21, 0.49, 1.61 + t * 0.4, 'body')),
		rail(
			[
				[-0.78 * span, 0, 1.4],
				[0.78 * span, 0, 2.2]
			],
			0.12,
			'shell'
		),
		bead(0.78 * span, 0, 2.44, 0.27, 0.85, 'slats')
	]),
	asset('tapered-wake', ['body'], [2.2, 2.2], (span, variant) => [
		vessel(
			[
				[0.55, 0],
				[0.77, 0.28],
				[0.69, 1.05],
				[0.32, 1.48],
				[0.55, 2.13],
				[0.26, 2.61]
			],
			4 + variant * 2,
			span + 0.45,
			'body',
			0.52
		)
	]),
	asset('balance-mobile', ['foot', 'frame', 'shell', 'body'], [3.5, 1.8], (span) => [
		post(0, 0, 0, 0.54, 0.16, 'foot'),
		post(0, 0, 0.16, 0.075, 2.16),
		rail(
			[
				[-1.42 * span, 0, 2.32],
				[1.42 * span, 0, 2.32]
			],
			0.065
		),
		post(-1.28 * span, 0, 1.77, 0.028, 0.55),
		eye(-1.28 * span, 0, 1.55, 0.23, 0.075, 0.08),
		bead(1.23 * span, 0, 2.45, 0.21, 1, 'body')
	]),
	glassArt('pleat-monolith', ['foot', 'body'], [2.8, 1.5], pleatedGlass),
	asset('loop-cairn', ['foot', 'shell'], [2.2, 2.4], (_span, variant) => [
		post(0, 0, 0, 0.61, 0.17, 'foot'),
		...row(2 + variant, (_, i) =>
			eye(0, ((i % 2) - 0.5) * 0.15, 0.64 + i * 0.83, 0.48, 0.17, 0.32, 'shell')
		)
	]),
	asset('offset-lenses', ['foot', 'frame', 'body'], [2.4, 2.4], (_span, variant) => [
		post(0, 0, 0, 0.45, 0.14, 'foot'),
		post(0, 0, 0.14, 0.12, 2.3),
		...row(2 + variant, (_, i) =>
			bead(
				((i % 2) - 0.5) * 0.37,
				0,
				0.57 + i * (1.58 / (1 + variant)),
				0.74 - i * 0.07,
				0.28,
				'body'
			)
		)
	]),
	asset('crosswind-arch', ['body', 'shell', 'slats'], [3.3, 2.6], (span) => [
		bow(0, -0.34, 0, 2.9 * span, 0.32, 1.7, 'body'),
		bow(0, 0.34, 0, 2.9 * span, 0.32, 2.15, 'shell'),
		rail(
			[
				[0, -0.34, 1.67],
				[0, 0.34, 2.13]
			],
			0.1,
			'slats'
		)
	]),
	stoneArt('quiet-spindle', ['foot', 'frame', 'body'], [1.9, 1.9], (factor) => {
		const height = 0.65 + 2.8 * factor,
			radius = 0.68;
		return [
			post(0, 0, 0, radius, 0.18, 'foot'),
			collar(0, 0, 0.18, radius, 0.21, height, 'body'),
			post(0, 0, 0.18, radius * 0.46, height * 1.2, 'frame')
		];
	})
];
