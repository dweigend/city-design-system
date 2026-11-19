import { suggestions } from './suggestions';
import { family, row } from '../assembly';
import { panel, post, rail, bow, eye, lens, bead } from './forms';

const asset = family('lighting', 'deck', suggestions);
export const lighting = [
	asset('quay-lantern', ['frame', 'diffuser', 'shell'], [2, 1.5], (span) => [
		post(-0.45, 0, 0, 0.12, 2.5 * span + 0.8),
		rail(
			[
				[-0.45, 0, 2.5 * span + 0.8],
				[0.45, 0, 2.5 * span + 0.8]
			],
			0.065
		),
		post(0.42, 0, 2.5 * span + 0.67, 0.32, 0.13, 'diffuser'),
		lens(0.42, 0, 2.5 * span + 0.8, 0.37, 0.15)
	]),
	asset('garden-cap', ['foot', 'frame', 'diffuser', 'shell'], [1.3, 1.3], (span) => [
		post(0, 0, 0, 0.22, 0.12, 'foot'),
		post(0, 0, 0.12, 0.065, 1.25 * span),
		post(0, 0, 1.25 * span + 0.12, 0.31, 0.075, 'diffuser'),
		lens(0, 0, 1.25 * span + 0.195, 0.39, 0.21)
	]),
	asset('pendant-rail', ['frame', 'diffuser', 'shell'], [3.3, 1.2], (span, variant) => [
		...row(2, (t) => post(t * 1.35 * span, 0, 0, 0.055, 2.4)),
		rail(
			[
				[-1.35 * span, 0, 2.4],
				[1.35 * span, 0, 2.4]
			],
			0.045
		),
		...row(2 + variant, (t) => post(t * 0.98 * span, 0, 1.8, 0.018, 0.6)),
		...row(2 + variant, (t) => post(t * 0.98 * span, 0, 1.77, 0.22, 0.08, 'diffuser')),
		...row(2 + variant, (t) => lens(t * 0.98 * span, 0, 1.85, 0.26, 0.14))
	]),
	asset('folio-floor-lamp', ['foot', 'frame', 'shell', 'diffuser'], [1.3, 1.3], (span) => [
		post(0, 0, 0, 0.45, 0.1, 'foot'),
		post(0, 0, 0.1, 0.05, 0.85 + span),
		bow(0, 0, 0.75 + span, 0.91, 0.6, 0.22),
		panel(0, 0, 0.85 + span, 0.64, 0.44, 0.045, 'diffuser')
	]),
	asset('forked-lamp', ['frame', 'diffuser', 'shell'], [2.6, 1.2], (span) => [
		post(0, 0, 0, 0.095, 2),
		...row(2, (t) =>
			rail(
				[
					[0, 0, 1.65],
					[t * 0.76 * span, 0, 2.15],
					[t * 0.9 * span, 0, 2.9]
				],
				0.06
			)
		),
		...row(2, (t) => bead(t * 0.9 * span, 0, 2.95, 0.23, 0.75, 'diffuser')),
		...row(2, (t) => lens(t * 0.9 * span, 0, 2.98, 0.27, 0.13))
	]),
	asset('lantern-stair', ['foot', 'frame', 'diffuser', 'shell'], [1.5, 1.5], (_span, variant) => [
		post(0, 0, 0, 0.32, 0.18, 'foot'),
		post(0, 0, 0.18, 0.09, 0.42 * (2 + variant)),
		...row(2 + variant, (_, i) => post(0, 0, 0.49 + i * 0.42, 0.23, 0.11, 'diffuser')),
		...row(2 + variant, (_, i) => lens(0, 0, 0.6 + i * 0.42, 0.3, 0.11))
	]),
	asset('verge-slot', ['foot', 'diffuser', 'shell'], [1.1, 1], (span) => [
		panel(0, 0, 0, 0.44, 0.4, 0.3 + 0.95 * span, 'foot'),
		panel(0, 0, 0.3 + 0.95 * span, 0.36, 0.34, 0.12, 'diffuser'),
		panel(0, 0, 0.42 + 0.95 * span, 0.48, 0.45, 0.07, 'shell')
	]),
	asset('halo-standard', ['foot', 'frame', 'shell', 'diffuser'], [1.5, 1.6], (span) => [
		post(0, 0, 0, 0.22, 0.12, 'foot'),
		post(0, 0, 0.12, 0.065, 1.1 + span),
		eye(0, 0, 1.55 + span, 0.45, 0.075, 0.12),
		eye(0.075, 0, 1.55 + span, 0.41, 0.045, 0.04, 'diffuser')
	]),
	asset('arcade-pendants', ['frame', 'diffuser'], [3.4, 1.2], (span, variant) => [
		bow(0, 0, 0, 3.1 * span, 0.18, 2.4, 'frame'),
		rail(
			[
				[-1.08 * span, 0, 1.7],
				[1.08 * span, 0, 1.7]
			],
			0.045
		),
		...row(2 + variant, (t) => post(t * 0.92 * span, 0, 1.36, 0.025, 0.34)),
		...row(2 + variant, (t) => bead(t * 0.92 * span, 0, 1.31, 0.14, 0.65, 'diffuser'))
	]),
	asset('path-washer', ['foot', 'frame', 'diffuser', 'shell'], [3.5, 1.1], (span, variant) => [
		panel(0, 0, 0, 3.2 * span, 0.52, 0.16, 'foot'),
		...row(2 + variant, (t) => post(t * 1.19 * span, 0, 0.16, 0.12, 0.32)),
		...row(2 + variant, (t) => panel(t * 1.19 * span, -0.09, 0.46, 0.42, 0.37, 0.075, 'diffuser')),
		...row(2 + variant, (t) => panel(t * 1.19 * span, -0.06, 0.535, 0.47, 0.43, 0.055, 'shell'))
	])
];
