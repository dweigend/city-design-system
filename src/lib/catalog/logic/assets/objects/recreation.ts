import { suggestions } from './suggestions';
import { family, row, circle } from '../assembly';
import { panel, post, rail, bow, bead, collar } from './forms';

const asset = family('recreation', 'deck', suggestions);
export const recreation = [
	asset('pebble-crossing', ['body', 'shell'], [4.7, 2], (_span, variant) => [
		...row(3 + variant, (t, i) =>
			post(t * 1.98, ((i % 2) - 0.5) * 0.67, 0, 0.3, 0.16 + i * 0.045, 'body')
		),
		...row(3 + variant, (t, i) =>
			bead(t * 1.98, ((i % 2) - 0.5) * 0.67, 0.17 + i * 0.045, 0.33, 0.15, 'shell')
		)
	]),
	asset('parallel-rails', ['frame', 'shell'], [3.5, 1.8], (span) => [
		...row(2, (t) => post(-1.35 * span, t * 0.54, 0, 0.06, 0.86)),
		...row(2, (t) => post(1.35 * span, t * 0.54, 0, 0.06, 0.86)),
		...row(2, (t) =>
			rail(
				[
					[-1.35 * span, t * 0.54, 0.86],
					[1.35 * span, t * 0.54, 0.86]
				],
				0.065,
				'shell'
			)
		)
	]),
	asset('balance-spine', ['foot', 'slats'], [4.6, 1.4], (span, variant) => [
		...row(3 + variant, (t) => post(t * 1.85 * span, 0, 0, 0.16, 0.36, 'foot')),
		panel(0, 0, 0.36, 4.22 * span, 0.23, 0.115)
	]),
	asset('crawl-rib-tunnel', ['shell', 'foot'], [2.4, 4.1], (_span, variant) => [
		...row(3 + variant, (t) => bow(0, t * 1.75, 0, 1.8, 0.2, 0.96, 'shell')),
		...row(2, (t) => panel(t * 0.85, 0, 0, 0.16, 3.75, 0.09, 'foot'))
	]),
	asset('basket-post', ['foot', 'frame', 'shell'], [2.7, 2.2], (span) => [
		post(-0.6, 0, 0, 0.35, 0.12, 'foot'),
		post(-0.6, 0, 0.12, 0.09, 1.45 + span),
		rail(
			[
				[-0.6, 0, 1.4 + span],
				[0.18, 0, 1.73 + span]
			],
			0.065
		),
		panel(0.18, 0, 1.61 + span, 0.085, 1.15, 0.65, 'shell'),
		collar(0.46, 0, 1.65 + span, 0.28, 0.04, 0.055, 'frame')
	]),
	asset('jump-gates', ['shell'], [4.8, 2.2], (span, variant) => [
		...row(2 + variant, (t) => bow(0, t * 0.78, 0, 3.7 * span, 0.09, 0.56, 'shell'))
	]),
	asset('ring-toss', ['foot', 'slats', 'shell'], [2.7, 2.7], (_span, variant) => [
		post(0, 0, 0, 1.03, 0.12, 'foot'),
		...circle(0.68, 3 + variant * 2).map(([x, y]) => post(x, y, 0.12, 0.047, 0.43, 'slats')),
		...circle(0.68, 3 + variant * 2).map(([x, y]) => collar(x, y, 0.12, 0.15, 0.035, 0.06, 'shell'))
	]),
	asset('vaulting-block', ['body', 'slats', 'shell'], [3, 1.4], (span) => [
		...row(2, (t) => panel(t * 0.86 * span, 0, 0, 0.25, 0.75, 0.56, 'body')),
		panel(0, 0, 0.56, 2.6 * span, 1, 0.22),
		bow(0, 0, 0.78, 2.6 * span, 1, 0.19, 'shell')
	]),
	asset('stretch-fan', ['frame', 'slats'], [3.3, 1.4], (_span, variant) => [
		...row(2 + variant, (t, i) => post(t * 1.36, 0, 0, 0.08, 0.57 + i * 0.28)),
		...row(2 + variant, (t, i) =>
			rail(
				[
					[t * 1.36, -0.39, 0.57 + i * 0.28],
					[t * 1.36, 0.39, 0.57 + i * 0.28]
				],
				0.055,
				'slats'
			)
		)
	]),
	asset('low-slalom', ['foot', 'shell', 'body'], [4.7, 1.8], (_span, variant) => [
		...row(3 + variant, (t, i) => post(t * 1.94, ((i % 2) - 0.5) * 0.75, 0, 0.24, 0.09, 'foot')),
		...row(3 + variant, (t, i) =>
			post(t * 1.94, ((i % 2) - 0.5) * 0.75, 0.09, 0.075, 0.79, 'shell')
		),
		...row(3 + variant, (t, i) => bead(t * 1.94, ((i % 2) - 0.5) * 0.75, 0.9, 0.11, 1, 'body'))
	])
];
