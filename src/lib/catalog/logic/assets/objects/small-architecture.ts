import { suggestions } from './suggestions';
import { family, row, circle } from '../assembly';
import { panel, post, rail, bow, lens, band, collar } from './forms';
import { sail } from './fabric';

const asset = family('small-architecture', 'deck', suggestions);
export const smallArchitecture = [
	asset('quay-waiting-room', ['foot', 'screen', 'slats', 'shell'], [5.3, 3.1], (span) => [
		...row(2, (t) => panel(t * 2.14 * span, 0.36, 0, 0.16, 1.91, 2.52, 'foot')),
		panel(0, 1.11, 0.48, 4.26 * span, 0.09, 1.85, 'screen'),
		panel(0, 0.65, 0.4, 4.35 * span, 0.7, 0.09),
		panel(0, 0, 2.52, 4.92 * span, 2.75, 0.14, 'shell')
	]),
	asset('court-gazebo', ['slats', 'shell'], [4.7, 4.7], (_span, variant) => [
		...circle(1.77, 4 + variant * 2).map(([x, y]) => post(x, y, 0, 0.105, 2.46, 'slats')),
		lens(0, 0, 2.46, 2.19, 0.54, 'shell'),
		collar(0, 0, 2.4, 1.9, 0.19, 0.1, 'slats')
	]),
	asset('vault-reading-room', ['body', 'foot', 'slats'], [5, 3.5], (span) => [
		bow(0, 0, 0, 4.6 * span, 3.16, 2.66, 'body'),
		...row(2, (t) => panel(t * 1.38 * span, 0, 0, 0.26, 2.55, 0.4, 'foot')),
		...row(2, (t) => panel(t * 1.38 * span, 0, 0.4, 0.62, 2.69, 0.08))
	]),
	asset('lantern-folly', ['foot', 'slats', 'screen', 'shell'], [4, 4], (_span, variant) => [
		...circle(1.45, 3 + variant).map(([x, y]) => post(x, y, 0, 0.14, 2.48, 'foot')),
		post(0, 0, 2.48, 1.75, 0.15, 'slats'),
		collar(0, 0, 2.63, 1.22, 0.09, 0.52, 'screen'),
		lens(0, 0, 3.15, 1.36, 0.32)
	]),
	asset('stepped-loggia', ['foot', 'frame', 'shell'], [5.5, 3.7], (span) => [
		...row(3, (_, i) => panel(0, 0.72 - i * 0.62, 0, 4.95 * span, 0.66, 0.45 - i * 0.15, 'foot')),
		...row(2, (t) => post(t * 2.2 * span, 0.89, 0.45, 0.09, 2.18)),
		panel(0, 0.1, 2.63, 5.08 * span, 2.85, 0.13, 'shell')
	]),
	asset('keyhole-porch', ['body', 'fabric', 'foot'], [4.6, 3.4], (span) => [
		...row(2, (t) => bow(0, t * 1.2, 0, 4.12 * span, 0.22, 2.55, 'body')),
		bow(0, 0, 0, 4.02 * span, 2.4, 2.49, 'fabric'),
		panel(0, 0.82, 0, 2.54 * span, 0.57, 0.45, 'foot')
	]),
	asset('garden-belvedere', ['foot', 'frame', 'slats', 'shell'], [5, 4], (span) => [
		panel(0, 0, 0, 4.55 * span, 3.3, 0.18, 'foot'),
		...row(2, (t) => post(t * 1.95 * span, 1.38, 0.18, 0.085, 2.4)),
		...row(2, (t) => post(t * 1.95 * span, -1.38, 0.18, 0.085, 2.4)),
		panel(0, 0, 2.58, 4.62 * span, 3.48, 0.12),
		rail(
			[
				[-1.95 * span, 1.38, 1.04],
				[1.95 * span, 1.38, 1.04]
			],
			0.055,
			'shell'
		)
	]),
	asset('sail-court', ['frame', 'fabric', 'body'], [5.4, 3.9], (span) => [
		...row(2, (t) => post(t * 2.32 * span, 1.54, 0, 0.11, 2.73)),
		...row(2, (t) => post(t * 2.32 * span, -1.54, 0, 0.11, 2.28)),
		sail(
			[
				[-2.32 * span, -1.54, 2.28],
				[2.32 * span, -1.54, 2.28],
				[2.32 * span, 1.54, 2.73],
				[-2.32 * span, 1.54, 2.73]
			],
			0.16
		),
		panel(0, 1.28, 0, 3.9 * span, 0.61, 0.45, 'body')
	]),
	asset('split-roof-porch', ['foot', 'shell', 'slats'], [5.6, 3.7], (span) => [
		...row(2, (t) => panel(t * 1.28 * span, 0.37, 0, 0.19, 1.85, 2.48 + t * 0.18, 'foot')),
		...row(2, (t) => bow(t * 1.28 * span, 0, 2.3 + t * 0.18, 2.53 * span, 3.16, 0.24, 'shell')),
		panel(0, 0.71, 0.42, 2.83 * span, 0.69, 0.075)
	]),
	asset('crescent-refuge', ['body', 'shell', 'slats'], [4.9, 4.9], (_span, variant) => [
		band(2.11, 0.22, 0, 2.23, 1.65 + variant * 0.68, 'body'),
		band(2.29, 1.35, 2.23, 0.14, 1.65 + variant * 0.68, 'shell'),
		band(1.92, 0.48, 0, 0.45, 1.65 + variant * 0.68, 'slats')
	])
];
