import { suggestions } from './suggestions';
import { family, row, circle } from '../assembly';
import { panel, post, rail, eye, lens, collar } from './forms';

const asset = family('wayfinding', 'deck', suggestions);
export const wayfinding = [
	asset('fingerpost-array', ['foot', 'frame', 'shell'], [2.9, 1.2], (_span, variant) => [
		post(0, 0, 0, 0.24, 0.1, 'foot'),
		post(0, 0, 0.1, 0.07, 2.35),
		...row(2 + variant, (_, i) =>
			panel(((i % 2) - 0.5) * 0.91, 0, 2.1 - i * 0.29, 1.14, 0.095, 0.19, 'shell')
		)
	]),
	asset('roundel-marker', ['foot', 'frame', 'shell'], [1.6, 1.6], (span) => {
		const lift = 2.4 * span - 0.6;
		return [
			post(0, 0, 0, 0.21, 0.12, 'foot'),
			post(0, 0, 0.12, 0.07, 0.96 + lift),
			eye(0, 0, 1.56 + lift, 0.54, 0.09, 0.1, 'shell'),
			rail(
				[
					[0, -0.5, 1.56 + lift],
					[0, 0.5, 1.56 + lift]
				],
				0.065
			)
		];
	}),
	asset('rail-map-board', ['frame', 'shell', 'slats'], [3.8, 1.2], (span, variant) => [
		...row(2, (t) => post(t * 1.55 * span, 0, 0, 0.065, 1.95)),
		panel(0, 0, 0.88, 3.08 * span, 0.09, 0.96, 'shell'),
		...row(2 + variant, (t, i) =>
			panel(t * 0.97 * span, -0.06, 1.04 + i * 0.09, 0.34, 0.04, 0.46, 'slats')
		)
	]),
	asset('beacon-stripes', ['foot', 'frame', 'shell'], [1.1, 1.1], (_span, variant) => [
		post(0, 0, 0, 0.34, 0.1, 'foot'),
		post(0, 0, 0.1, 0.18, 0.48 * (2 + variant)),
		...row(2 + variant, (_, i) => collar(0, 0, 0.32 + i * 0.48, 0.225, 0.06, 0.145, 'shell'))
	]),
	asset('trail-chevron', ['foot', 'frame', 'shell'], [1.9, 1.2], (span) => {
		const lift = 2 * span - 0.5;
		return [
			post(0, 0, 0, 0.24, 0.1, 'foot'),
			post(0, 0, 0.1, 0.07, 0.9 + lift),
			rail(
				[
					[-0.65, 0, 1 + lift],
					[0, 0, 1 + lift],
					[0.61, 0, 1 + lift]
				],
				0.065,
				'shell'
			),
			rail(
				[
					[0.25, 0, 1.29 + lift],
					[0.62, 0, 1 + lift],
					[0.25, 0, 0.71 + lift]
				],
				0.065,
				'shell'
			)
		];
	}),
	asset('route-tabs', ['foot', 'shell', 'frame'], [2.6, 1.2], (span, variant) => [
		panel(0, 0, 0, 2.25 * span, 0.65, 0.12, 'foot'),
		...row(2 + variant, (t, i) =>
			panel(t * 0.83 * span, 0, 0.12, 0.32, 0.12, 1.2 + i * 0.35, 'shell')
		),
		...row(2 + variant, (t, i) =>
			eye(t * 0.83 * span, 0, 1.43 + i * 0.35, 0.15, 0.055, 0.1, 'frame')
		)
	]),
	asset('district-gateway', ['foot', 'shell', 'slats'], [4.6, 1.4], (span, variant) => [
		...row(2, (t) => panel(t * 1.93 * span, 0, 0, 0.17, 0.65, 2.6, 'foot')),
		panel(0, 0, 2.48, 4.05 * span, 0.2, 0.41, 'shell'),
		...row(2 + variant, (t) => panel(t * 1.23 * span, -0.13, 2.59, 0.18, 0.07, 0.17))
	]),
	asset('directory-drum', ['foot', 'frame', 'shell', 'slats'], [1.8, 1.8], (span) => {
		const rise = 1.65 * span - 0.48;
		return [
			post(0, 0, 0, 0.54, 0.17, 'foot'),
			post(0, 0, 0.17, 0.17, 0.46),
			post(0, 0, 0.63, 0.63, 0.44 + rise, 'shell'),
			collar(0, 0, 0.63, 0.67, 0.065, 0.09, 'slats'),
			lens(0, 0, 1.07 + rise, 0.67, 0.14)
		];
	}),
	asset('frame-noticeboard', ['frame', 'slats', 'screen', 'shell'], [3.4, 1.2], (span) => [
		...row(2, (t) => post(t * 1.33 * span, 0, 0, 0.065, 2.17)),
		panel(0, 0, 0.82, 2.7 * span, 0.11, 1.19, 'slats'),
		panel(0, -0.083, 0.92, 2.37 * span, 0.045, 0.95, 'screen'),
		panel(0, 0, 2.04, 3 * span, 0.46, 0.075, 'shell')
	]),
	asset('junction-petals', ['foot', 'frame', 'shell'], [2.9, 2.9], (_span, variant) => [
		post(0, 0, 0, 0.28, 0.14, 'foot'),
		post(0, 0, 0.14, 0.085, 2.3),
		...circle(0.5, 3 + variant).map(([x, y]) =>
			rail(
				[
					[0, 0, 2.3],
					[x, y, 2.3]
				],
				0.047
			)
		),
		...circle(0.72, 3 + variant).map(([x, y]) => post(x, y, 2.26, 0.31, 0.09, 'shell'))
	])
];
