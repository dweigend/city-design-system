import { suggestions } from './suggestions';
import { family, row, circle } from '../assembly';
import { panel, post, rail, bow, band } from './forms';

const asset = family('tables', 'deck', suggestions);
export const tables = [
	asset('split-trestle', ['foot', 'slats'], [3.4, 1.5], (span) => [
		...row(2, (t) => bow(t * 0.83 * span, 0, 0, 0.9 * span, 0.65, 0.69, 'foot')),
		panel(0, 0, 0.69, 3.1 * span, 1.1, 0.075)
	]),
	asset('mushroom-counter', ['foot', 'frame', 'slats'], [2.2, 2.2], (span) => [
		post(0, 0, 0, 0.55, 0.09, 'foot'),
		post(0, 0, 0.09, 0.18, 0.86),
		post(0, 0, 0.95, 0.96 * span, 0.075, 'slats')
	]),
	asset('ladder-desk', ['shell', 'slats'], [3.2, 1.2], (span) => [
		...row(2, (t) => panel(t * 1.22 * span, 0, 0, 0.11, 0.84, 0.74, 'shell')),
		panel(0, 0, 0.74, 2.8 * span, 1, 0.07),
		panel(0, 0.32, 0.24, 2.45 * span, 0.18, 0.07)
	]),
	asset('orbit-tea-table', ['body', 'frame', 'slats'], [2.6, 2.6], (_span, variant) => [
		post(0, 0, 0, 0.48, 0.12, 'body'),
		post(0, 0, 0.12, 0.16, 0.33),
		post(0, 0, 0.45, 0.42, 0.07, 'slats'),
		...circle(0.57, 2 + variant).map(([x, y]) => post(x, y, 0, 0.15, 0.4, 'body')),
		...circle(0.57, 2 + variant).map(([x, y]) => post(x, y, 0.4, 0.32, 0.065, 'slats'))
	]),
	asset('folding-buffet', ['frame', 'slats'], [3.4, 1.2], (span) => [
		...row(2, (t) =>
			rail(
				[
					[-1.15 * span, t * 0.4, 0.15],
					[1.15 * span, t * 0.4, 0.91]
				],
				0.15
			)
		),
		...row(2, (t) =>
			rail(
				[
					[1.15 * span, t * 0.4, 0.15],
					[-1.15 * span, t * 0.4, 0.91]
				],
				0.15
			)
		),
		panel(0, 0, 0.91, 3.1 * span, 1, 0.07)
	]),
	asset('rim-bar', ['body', 'slats'], [3.4, 3.4], (_span, variant) => [
		band(1.45, 0.28, 0, 0.98, 1.5 + variant * 1.65, 'body'),
		band(1.58, 0.55, 0.98, 0.08, 1.5 + variant * 1.65, 'slats')
	]),
	asset('island-worktop', ['foot', 'slats', 'shell'], [3.8, 1.6], (span, variant) => [
		panel(0, 0, 0, 2.9 * span, 0.84, 0.74, 'foot'),
		panel(0, 0, 0.74, 3.5 * span, 1.35, 0.09),
		...row(2 + variant, (t) => post(t * 1.1 * span, 0.48, 0.83, 0.12, 0.09, 'shell'))
	]),
	asset('reading-counter', ['body', 'slats', 'shell'], [3.4, 1.3], (span) => [
		panel(0, 0.27, 0, 2.7 * span, 0.22, 0.94, 'body'),
		panel(0, 0, 0.94, 3.1 * span, 1, 0.075),
		panel(0, 0.45, 1.015, 3 * span, 0.07, 0.15, 'shell')
	]),
	asset('satellite-desks', ['body', 'slats'], [3.8, 2], (_span, variant) => [
		...row(2 + variant, (t, i) => post(t * 1.38, ((i % 2) - 0.5) * 0.6, 0, 0.16, 0.69, 'body')),
		...row(2 + variant, (t, i) => post(t * 1.38, ((i % 2) - 0.5) * 0.6, 0.69, 0.47, 0.07, 'slats'))
	]),
	asset('bridge-console', ['shell', 'foot'], [3.2, 1.2], (span) => [
		bow(0, 0, 0, 2.9 * span, 0.75, 0.84, 'shell'),
		panel(0, 0, 0.815, 2.95 * span, 0.95, 0.085, 'foot')
	])
];
