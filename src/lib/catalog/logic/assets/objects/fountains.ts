import { suggestions } from './suggestions';
import { family, row, circle } from '../assembly';
import { panel, post, rail, bow, band, collar } from './forms';

const asset = family('fountains', 'deck', suggestions);
export const fountains = [
	asset('lip-drinking-bowl', ['foot', 'frame', 'body', 'liquid'], [1.8, 1.8], (span) => {
		const lift = 1.05 * span - 0.47;
		return [
			post(0, 0, 0, 0.32, 0.14, 'foot'),
			post(0, 0, 0.14, 0.15, 0.5 + lift),
			post(0, 0, 0.64 + lift, 0.43, 0.07, 'body'),
			collar(0, 0, 0.71 + lift, 0.45, 0.06, 0.095),
			post(0, 0, 0.71 + lift, 0.38, 0.025, 'liquid'),
			rail(
				[
					[0, 0.34, 0.74 + lift],
					[0, 0.34, 0.95 + lift],
					[0, 0.17, 0.97 + lift]
				],
				0.035
			)
		];
	}),
	asset('court-rain-dish', ['foot', 'body', 'liquid', 'frame'], [2.8, 2.8], (span) => [
		post(0, 0, 0, 1.22 * span, 0.1, 'foot'),
		collar(0, 0, 0.1, 1.22 * span, 0.1, 0.28, 'body'),
		post(0, 0, 0.1, 1.22 * span - 0.12, 0.22, 'liquid'),
		post(0, 0, 0.31, 0.085, 0.39, 'frame')
	]),
	asset('cascade-shelves', ['foot', 'liquid'], [3.5, 1.6], (_span, variant) => [
		...row(2 + variant, (t, i) => panel(t * 1.31, 0, 0, 0.76, 1.1, 0.26 + i * 0.24, 'foot')),
		...row(2 + variant, (t, i) => panel(t * 1.31, 0, 0.26 + i * 0.24, 0.69, 0.91, 0.055, 'liquid'))
	]),
	asset('reed-jets', ['foot', 'body', 'liquid'], [2.6, 2.6], (_span, variant) => [
		post(0, 0, 0, 1.17, 0.12, 'foot'),
		collar(0, 0, 0.12, 1.17, 0.08, 0.16, 'body'),
		post(0, 0, 0.12, 1.07, 0.12, 'liquid'),
		...circle(0.6, 3 + variant * 2).map(([x, y]) => post(x, y, 0.24, 0.035, 0.7, 'liquid'))
	]),
	asset('bubbler-rail', ['foot', 'frame', 'body'], [3.6, 1.3], (span, variant) => [
		panel(0, 0, 0, 3.2 * span, 0.8, 0.13, 'foot'),
		...row(2 + variant, (t, i) => post(t * 1.13 * span, 0, 0.13, 0.12, 0.56 + (i % 2) * 0.22)),
		...row(2 + variant, (t, i) =>
			post(t * 1.13 * span, 0, 0.69 + (i % 2) * 0.22, 0.27, 0.085, 'body')
		),
		...row(2 + variant, (t, i) =>
			collar(t * 1.13 * span, 0, 0.775 + (i % 2) * 0.22, 0.27, 0.055, 0.065)
		),
		...row(2 + variant, (t, i) =>
			post(t * 1.13 * span, 0.15, 0.775 + (i % 2) * 0.22, 0.04, 0.09, 'frame')
		)
	]),
	asset('arc-runnel', ['foot', 'liquid', 'body'], [3.4, 3.4], (_span, variant) => [
		band(1.48, 0.45, 0, 0.15, 1.55 + variant * 1.55, 'foot'),
		band(1.45, 0.38, 0.15, 0.065, 1.55 + variant * 1.55, 'liquid'),
		band(1.48, 0.07, 0.15, 0.14, 1.55 + variant * 1.55, 'body'),
		band(1.09, 0.06, 0.15, 0.14, 1.55 + variant * 1.55, 'body')
	]),
	asset('spring-table', ['foot', 'frame', 'body', 'liquid'], [2.8, 2.8], (span) => [
		post(0, 0, 0, 0.44, 0.12, 'foot'),
		post(0, 0, 0.12, 0.19, 0.54),
		post(0, 0, 0.66, 1.2 * span, 0.1, 'body'),
		collar(0, 0, 0.76, 1.2 * span, 0.08, 0.1, 'body'),
		post(0, 0, 0.76, 1.2 * span - 0.09, 0.055, 'liquid')
	]),
	asset('spout-wall', ['foot', 'body', 'liquid', 'frame'], [3.3, 1.8], (span, variant) => [
		panel(0, 0.53, 0, 2.95 * span, 0.26, 1.72, 'foot'),
		panel(0, -0.13, 0, 2.98 * span, 1.15, 0.29, 'body'),
		panel(0, -0.13, 0.29, 2.72 * span, 0.94, 0.045, 'liquid'),
		...row(2 + variant, (t) =>
			rail(
				[
					[t * 0.93 * span, 0.41, 1.35],
					[t * 0.93 * span, -0.14, 1.35],
					[t * 0.93 * span, -0.18, 1.23]
				],
				0.048
			)
		)
	]),
	asset('stepped-pools', ['foot', 'body', 'liquid'], [3.9, 2], (_span, variant) => [
		...row(2 + variant, (t, i) =>
			post(t * 1.36, ((i % 2) - 0.5) * 0.46, 0, 0.51, 0.22 + i * 0.14, 'foot')
		),
		...row(2 + variant, (t, i) =>
			collar(t * 1.36, ((i % 2) - 0.5) * 0.46, 0.22 + i * 0.14, 0.51, 0.07, 0.13)
		),
		...row(2 + variant, (t, i) =>
			post(t * 1.36, ((i % 2) - 0.5) * 0.46, 0.22 + i * 0.14, 0.43, 0.07, 'liquid')
		)
	]),
	asset('bottle-fill-arch', ['body', 'foot', 'liquid', 'frame'], [2.2, 1.5], (span) => [
		bow(0, 0, 0, 1.7 * span, 0.43, 1.51, 'body'),
		panel(0, 0, 0.35, 1.55 * span, 0.66, 0.085, 'foot'),
		panel(0, 0, 0.435, 1.32 * span, 0.54, 0.035, 'liquid'),
		post(0, 0, 1.32, 0.052, 0.16, 'frame')
	])
];
