import { suggestions } from './suggestions';
import { family, row } from '../assembly';
import { panel, post, rail, bow, bead } from './forms';

const asset = family('display', 'deck', suggestions);
export const display = [
	asset('ladder-shelves', ['frame', 'slats'], [2.8, 1.1], (span, variant) => [
		...row(2, (t) =>
			rail(
				[
					[t * 1.15 * span, -0.32, 0.03],
					[t * 1.15 * span, 0.32, 1.85]
				],
				0.05
			)
		),
		...row(2, (t) => post(t * 1.15 * span, 0.32, 0, 0.05, 1.85)),
		...row(2 + variant, (_, i) =>
			panel(0, 0.02, 0.28 + i * (1.45 / (1 + variant)), 2.5 * span, 0.68, 0.065)
		)
	]),
	asset('drum-display', ['foot', 'frame', 'slats'], [1.6, 1.6], (_span, variant) => [
		post(0, 0, 0, 0.4, 0.12, 'foot'),
		post(0, 0, 0.12, 0.09, 0.55 * (2 + variant)),
		...row(2 + variant, (_, i) => post(0, 0, 0.56 + i * 0.55, 0.67 - i * 0.065, 0.075, 'slats'))
	]),
	asset('bridge-bookcase', ['body', 'slats', 'shell'], [3.1, 1.2], (span, variant) => [
		...row(2, (t) => panel(t * 1.27 * span, 0, 0, 0.13, 0.8, 1.62, 'body')),
		...row(3 + variant, (_, i) =>
			panel(0, 0, 0.18 + i * (1.38 / (2 + variant)), 2.65 * span, 0.8, 0.075)
		),
		bow(0, 0, 1.62, 2.7 * span, 0.8, 0.4)
	]),
	asset('window-vitrine', ['foot', 'screen', 'shell'], [2.9, 1.4], (span) => [
		panel(0, 0, 0, 2.6 * span, 1.1, 0.54, 'foot'),
		...row(2, (t) => panel(t * 1.19 * span, 0, 0.54, 0.05, 1.01, 0.77, 'screen')),
		...row(2, (t) => panel(0, t * 0.47, 0.54, 2.4 * span, 0.04, 0.77, 'screen')),
		panel(0, 0, 1.31, 2.65 * span, 1.1, 0.075, 'shell')
	]),
	asset('fan-cards', ['foot', 'shell', 'slats'], [2.8, 1.3], (span, variant) => [
		panel(0, 0, 0, 2.5 * span, 0.82, 0.13, 'foot'),
		...row(2 + variant, (t, i) =>
			panel(t * 0.85 * span, ((i % 2) - 0.5) * 0.23, 0.13, 0.52, 0.08, 0.8 + i * 0.14, 'shell')
		),
		...row(2 + variant, (t, i) =>
			panel(t * 0.85 * span, ((i % 2) - 0.5) * 0.23 - 0.11, 0.5 + i * 0.14, 0.55, 0.23, 0.05)
		)
	]),
	asset('sample-steps', ['foot'], [3.4, 1.75], (span, variant) => [
		...row(2 + variant, (_, i) =>
			panel(0, -0.66 + i * (1.32 / (1 + variant)), 0, 3.05 * span, 0.39, 0.35 + i * 0.26, 'foot')
		)
	]),
	asset('gallery-grid', ['shell', 'slats'], [3.1, 1.1], (span, variant) => [
		...row(3 + variant, (t) => panel(t * 1.2 * span, 0, 0, 0.065, 0.8, 1.56, 'shell')),
		...row(3, (_, i) => panel(0, 0, 0.08 + i * 0.71, 2.7 * span, 0.86, 0.065))
	]),
	asset('cantilever-rack', ['foot', 'frame', 'slats'], [2.9, 1.3], (span, variant) => [
		panel(0, 0, 0, 2.6 * span, 1.09, 0.11, 'foot'),
		...row(2, (t) => post(t * 0.85 * span, 0.34, 0.11, 0.07, 1.75)),
		...row(2 + variant, (_, i) =>
			panel(0, 0, 0.48 + i * (1.22 / (1 + variant)), 2.5 * span, 0.86, 0.09)
		)
	]),
	asset('globe-plinth', ['foot', 'body', 'slats'], [1.8, 1.8], (span) => [
		post(0, 0, 0, 0.54, 0.12, 'foot'),
		bead(0, 0, 0.12 + 0.54 * span, 0.55, span, 'body'),
		post(0, 0, 0.12 + 1.08 * span, 0.6, 0.075, 'slats')
	]),
	asset('folded-folio-stand', ['body', 'slats', 'shell'], [2.8, 1.1], (span, variant) => [
		...row(2, (t) => bow(t * 0.63 * span, 0, 0, 0.96 * span, 0.65, 0.72, 'body')),
		panel(0, 0, 0.72, 2.5 * span, 0.78, 0.07),
		...row(2 + variant, (t) => panel(t * 0.9 * span, 0.24, 0.79, 0.08, 0.32, 0.34, 'shell'))
	])
];
