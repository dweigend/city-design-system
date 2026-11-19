import { suggestions } from './suggestions';
import { family, row, circle } from '../assembly';
import { panel, post, rail, bow, eye, bead, band } from './forms';

const asset = family('seating', 'deck', suggestions);
export const seating = [
	asset('runner-settee', ['frame', 'slats'], [3.2, 1.1], (span) => [
		...row(2, (t) => bow(0, t * 0.31, 0, 2.7 * span, 0.085, 0.38, 'frame')),
		panel(0, 0, 0.38, 2.8 * span, 0.8, 0.075),
		panel(0, 0.34, 0.455, 2.7 * span, 0.085, 0.34)
	]),
	asset('button-perch', ['foot', 'frame', 'shell'], [1.4, 1.4], (span) => [
		post(0, 0, 0, 0.31, 0.09, 'foot'),
		post(0, 0, 0.09, 0.1, 0.28),
		bead(0, 0, 0.39, 0.1 + 0.54 * span, 0.16, 'shell')
	]),
	asset('reading-wing', ['foot', 'slats'], [2.7, 1.3], (span) => [
		panel(0, 0, 0, 1.9 * span, 0.66, 0.38, 'foot'),
		panel(0, 0, 0.38, 2.1 * span, 0.82, 0.075),
		panel(0, 0.38, 0.455, 2.1 * span, 0.07, 0.52),
		panel(-span, 0.04, 0.455, 0.08, 0.7, 0.26)
	]),
	asset('quay-recliner', ['slats', 'foot'], [2.8, 1.1], (span) => [
		...row(6, (t) =>
			rail(
				[
					[-1.25 * span, t * 0.41, 0.68],
					[-0.5 * span, t * 0.41, 0.43],
					[0, t * 0.41, 0.34],
					[0.55 * span, t * 0.41, 0.48],
					[1.25 * span, t * 0.41, 0.93]
				],
				0.072,
				'slats'
			)
		),
		...row(2, (t) => panel(t * 0.5 * span, 0, 0, 0.18, 0.9, t < 0 ? 0.45 : 0.49, 'foot'))
	]),
	asset('gallery-banquette', ['body', 'slats'], [3.8, 1.5], (span, variant) => [
		panel(0, 0, 0, 3.3 * span, 0.76, 0.38, 'body'),
		panel(0, 0, 0.38, 3.55 * span, 1, 0.08),
		...row(2 + variant, (t) => bead(t * 1.05 * span, 0.35, 0.71, 0.37, 0.85, 'body'))
	]),
	asset('fan-stool', ['frame', 'slats'], [1.6, 1.6], (span, variant) => [
		...circle(0.28 + 0.24 * span, 3 + variant).map(([x, y]) =>
			rail(
				[
					[x, y, 0.03],
					[x * 0.55, y * 0.55, 0.37]
				],
				0.04
			)
		),
		post(0, 0, 0.37, 0.34 + 0.2 * span, 0.08, 'slats')
	]),
	asset('arc-divan', ['foot', 'slats', 'body'], [3.2, 3.2], (_span, variant) => [
		band(1.45, 0.64, 0, 0.38, 1.8 + variant * 1.55),
		band(1.45, 0.67, 0.38, 0.08, 1.8 + variant * 1.55, 'slats'),
		band(1.45, 0.09, 0.46, 0.32, 1.8 + variant * 1.55, 'body')
	]),
	asset('skate-rest', ['foot', 'slats', 'shell'], [3.6, 1.2], (span) => [
		...row(2, (t) => post(t * 1.2 * span, 0, 0, 0.16, 0.38, 'foot')),
		panel(0, 0, 0.38, 3.2 * span, 0.65, 0.08),
		...row(2, (t) => eye(t * 1.15 * span, 0, 0.6, 0.25, 0.045, 0.065))
	]),
	asset('conversation-pads', ['body', 'slats'], [3, 1.5], (_span, variant) => [
		...row(2 + variant, (t, i) => post(t * 1.05, ((i % 2) - 0.5) * 0.48, 0, 0.34, 0.44, 'body')),
		...row(2 + variant, (t, i) =>
			post(t * 1.05, ((i % 2) - 0.5) * 0.48, 0.44, 0.36, 0.055, 'slats')
		)
	]),
	asset('ribbon-chaise', ['foot', 'slats'], [2.8, 1.5], (span) => [
		...row(2, (t) => panel(t * 0.67 * span, 0, 0, 0.18, 0.68, 0.37, 'foot')),
		bow(0, 0, 0.32, 2.4 * span, 0.88, 0.4, 'slats', false)
	])
];
