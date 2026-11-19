import { suggestions } from './suggestions';
import { family, row } from '../assembly';
import { panel, post, bow, eye, lens, collar } from './forms';

const asset = family('recycling', 'deck', suggestions);
export const recycling = [
	asset('sorting-collars', ['foot', 'shell', 'slats'], [3.8, 1.5], (_span, variant) => [
		panel(0, 0, 0, 3.45, 1.13, 0.1, 'foot'),
		...row(2 + variant, (t) => collar(t * 1.25, 0, 0.1, 0.38, 0.055, 0.8, 'shell')),
		...row(2 + variant, (t) => collar(t * 1.25, 0, 0.9, 0.4, 0.19, 0.08, 'slats'))
	]),
	asset('slot-litter-bin', ['foot', 'shell', 'frame'], [1.6, 1.6], (span) => [
		post(0, 0, 0, 0.46, 0.13, 'foot'),
		collar(0, 0, 0.13, 0.43, 0.06, 0.45 + 0.6 * span, 'shell'),
		...row(2, (t) => post(t * 0.36, 0, 0.58 + 0.6 * span, 0.045, 0.2)),
		lens(0, 0, 0.78 + 0.6 * span, 0.49, 0.14)
	]),
	asset('bottle-bank', ['foot', 'body', 'shell'], [2.3, 1.8], (span) => [
		panel(0, 0, 0, 1.94 * span, 1.37, 0.15, 'foot'),
		collar(0, 0, 0.15, 0.65 * span, 0.075, 0.84, 'body'),
		collar(0, 0, 0.99, 0.65 * span, 0.4 * span, 0.16, 'shell')
	]),
	asset('paper-drop', ['shell', 'frame', 'slats'], [2, 1.4], (span) => [
		panel(0, 0, 0, 1.74 * span, 1.01, 0.82, 'shell'),
		...row(2, (t) => panel(t * 0.78 * span, 0, 0.82, 0.09, 0.94, 0.16, 'frame')),
		panel(0, 0, 0.98, 1.8 * span, 1.1, 0.1, 'slats')
	]),
	asset('return-crates', ['foot', 'body', 'slats'], [3.7, 1.5], (_span, variant) => [
		panel(0, 0, 0, 3.4, 1.05, 0.11, 'foot'),
		...row(2 + variant, (t) => collar(t * 1.24, 0, 0.11, 0.38, 0.07, 0.57, 'body')),
		...row(2 + variant, (t) => collar(t * 1.24, 0, 0.68, 0.4, 0.085, 0.08, 'slats'))
	]),
	asset('pedal-drum', ['foot', 'shell', 'body', 'frame'], [1.7, 1.8], (span) => [
		post(0, 0, 0, 0.41, 0.12, 'foot'),
		collar(0, 0, 0.12, 0.41, 0.05, 0.38 + span * 0.7, 'shell'),
		lens(0, 0, 0.5 + span * 0.7, 0.43, 0.1, 'body'),
		panel(0, -0.41, 0.09, 0.25, 0.27, 0.055, 'frame')
	]),
	asset('canopy-sorter', ['foot', 'shell', 'frame', 'slats'], [3.9, 1.7], (_span, variant) => [
		panel(0, 0, 0, 3.5, 1.15, 0.13, 'foot'),
		...row(2 + variant, (t) => collar(t * 1.27, 0, 0.13, 0.38, 0.065, 0.76, 'shell')),
		...row(2, (t) => post(t * 1.58, 0.45, 0.13, 0.055, 1.31)),
		bow(0, 0, 1.44, 3.48, 1.41, 0.25, 'slats')
	]),
	asset('corner-salvage-bin', ['foot', 'body', 'shell', 'frame'], [2, 2], (span) => [
		post(0, 0, 0, 0.74 * span, 0.11, 'foot'),
		collar(0, 0, 0.11, 0.74 * span, 0.09, 0.65, 'body'),
		collar(0, 0, 0.76, 0.8 * span, 0.17, 0.1, 'shell'),
		...row(2, (t) => eye(t * 0.69 * span, 0, 0.61, 0.13, 0.045, 0.075, 'frame'))
	]),
	asset('tray-return', ['shell', 'slats'], [2.8, 1.5], (span, variant) => [
		...row(2, (t) => panel(t * 1.03 * span, 0, 0, 0.11, 0.91, 1.29, 'shell')),
		...row(3 + variant, (_, i) =>
			panel(0, 0, 0.22 + i * (1.02 / (2 + variant)), 2.14 * span, 0.98, 0.055, 'slats')
		)
	]),
	asset('screened-composter', ['foot', 'slats'], [2.7, 1.8], (span, variant) => [
		panel(0, 0, 0, 2.36 * span, 1.44, 0.12, 'foot'),
		...row(2, (t) => panel(t * 1.09 * span, 0, 0.12, 0.085, 1.35, 0.94, 'slats')),
		...row(4 + variant, (_, i) =>
			panel(0, 0.65, 0.18 + i * (0.82 / (3 + variant)), 2.26 * span, 0.08, 0.13, 'slats')
		),
		...row(4 + variant, (_, i) =>
			panel(0, -0.65, 0.18 + i * (0.82 / (3 + variant)), 2.26 * span, 0.08, 0.13, 'slats')
		)
	])
];
