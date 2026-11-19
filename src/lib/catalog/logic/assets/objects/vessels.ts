import { suggestions } from './suggestions';
import { family, row, circle } from '../assembly';
import { panel, post, rail, bead, band, collar } from './forms';
import { vessel } from '../pottery';

const asset = family('vessels', 'deck', suggestions);
export const vessels = [
	asset('rolled-lip-planter', ['body'], [1.6, 1.6], (span) => [
		vessel(
			[
				[0.36, 0],
				[0.43, 0.08],
				[0.62, 0.85],
				[0.69, 0.87],
				[0.69, 0.97],
				[0.59, 1]
			],
			32,
			0.5 + span,
			'body'
		)
	]),
	asset('keel-trough', ['foot', 'body'], [3.3, 1.2], (span) => [
		panel(0, 0, 0, 2.9 * span, 0.9, 0.12, 'foot'),
		...row(2, (t) => panel(0, t * 0.43, 0.12, 2.9 * span, 0.09, 0.48, 'body')),
		...row(2, (t) => panel(t * (1.45 * span - 0.045), 0, 0.12, 0.09, 0.8, 0.48, 'body'))
	]),
	asset('pinched-orchid-cup', ['body'], [1.6, 1.6], (span, variant) => [
		vessel(
			[
				[0.29, 0],
				[0.45, 0.18],
				[0.32, 0.48],
				[0.62, 1],
				[0.65, 1.06]
			],
			6 + variant * 5,
			span + 0.48,
			'body',
			0.22
		)
	]),
	asset('ring-nursery', ['foot', 'body'], [3.2, 3.2], (_span, variant) => [
		band(1.35, 0.52, 0, 0.1, 2 + variant * 1.6),
		band(1.35, 0.07, 0.1, 0.42, 2 + variant * 1.6, 'body'),
		band(0.9, 0.07, 0.1, 0.42, 2 + variant * 1.6, 'body'),
		...[0, 2 + variant * 1.6].map((a) =>
			rail(
				[
					[0.87 * Math.cos(a), 0.87 * Math.sin(a), 0.31],
					[1.32 * Math.cos(a), 1.32 * Math.sin(a), 0.31]
				],
				0.2,
				'body'
			)
		)
	]),
	asset('terrace-pots', ['foot', 'body'], [3.8, 1.3], (_span, variant) => [
		panel(0, 0, 0, 3.55, 0.98, 0.15, 'foot'),
		...row(2 + variant, (t) =>
			collar(t * 1.32, 0, 0.15, 0.38, 0.065, 0.42 + (0.5 + t * 0.5) * 0.28)
		),
		...row(2 + variant, (t) => post(t * 1.32, 0, 0.15, 0.32, 0.065, 'body'))
	]),
	asset('fluted-courtyard-pot', ['body'], [1.9, 1.9], (span, variant) => [
		vessel(
			[
				[0.52, 0],
				[0.66, 0.14],
				[0.8, 0.92],
				[0.76, 1.02]
			],
			12 + variant * 8,
			span + 0.4,
			'body',
			0.18,
			0.1
		)
	]),
	asset('footed-bulb-bowl', ['foot', 'body'], [1.9, 1.9], (_span, variant) => [
		post(0, 0, 0, 0.36, 0.15, 'foot'),
		vessel(
			[
				[0.25, 0.15],
				[0.28, 0.28],
				[0.66, 0.46],
				[0.81, 0.72],
				[0.8, 0.78]
			],
			32,
			0.95,
			'body'
		),
		...circle(0.8, 3 + variant * 2).map(([x, y]) => bead(x * 0.85, y * 0.85, 0.55, 0.12, 1, 'body'))
	]),
	asset('tower-cachepot', ['body', 'shell'], [1.5, 1.5], (span, variant) => [
		vessel(
			[
				[0.44, 0],
				[0.5, 0.07],
				[0.39, 0.8],
				[0.57, 1.25],
				[0.56, 1.32]
			],
			8 + variant * 4,
			span + 0.42,
			'body'
		),
		collar(0, 0, 0.09, 0.5, 0.13, 0.08, 'shell')
	]),
	asset('sleeve-urn', ['body', 'shell'], [1.5, 1.5], (span) => [
		vessel(
			[
				[0.4, 0],
				[0.48, 0.13],
				[0.48, 0.65],
				[0.57, 0.94],
				[0.53, 1.06]
			],
			24,
			span + 0.45,
			'body'
		),
		collar(0, 0, 0.14, 0.51, 0.08, 0.23, 'shell')
	]),
	asset('courtyard-well-pot', ['foot', 'body', 'slats'], [2.4, 2.4], (span) => [
		post(0, 0, 0, 0.92 * span, 0.1, 'foot'),
		collar(0, 0, 0.1, 0.93 * span, 0.1, 0.48, 'body'),
		collar(0, 0, 0.58, 1.04 * span, 0.14, 0.08, 'slats')
	])
];
