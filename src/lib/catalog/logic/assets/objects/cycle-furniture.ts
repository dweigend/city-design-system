import { suggestions } from './suggestions';
import { family, row } from '../assembly';
import { panel, post, rail, bow, eye } from './forms';

const asset = family('cycle-furniture', 'deck', suggestions);
export const cycleFurniture = [
	asset('fin-cycle-rack', ['foot', 'shell'], [3.7, 1.5], (_span, variant) => [
		panel(0, 0, 0, 3.4, 1.05, 0.08, 'foot'),
		...row(3 + variant, (t) => eye(t * 1.43, 0, 0.53, 0.45, 0.09, 0.095))
	]),
	asset('scooter-comb', ['foot', 'shell'], [3.5, 1.4], (_span, variant) => [
		panel(0, 0, 0, 3.1, 0.88, 0.16, 'foot'),
		...row(3 + variant * 2, (t) => bow(t * 1.3, 0, 0.16, 0.33, 0.58, 0.38, 'shell'))
	]),
	asset('repair-leaner', ['foot', 'frame', 'shell'], [2.5, 1.4], (span) => [
		panel(0, 0, 0, 2.2 * span, 0.84, 0.12, 'foot'),
		post(-0.64 * span, 0, 0.12, 0.085, 1.2),
		rail(
			[
				[-0.64 * span, 0, 1.3],
				[0.72 * span, 0, 1.3]
			],
			0.065
		),
		...row(2, (t) => eye(t * 0.62 * span, 0, 1.37, 0.15, 0.05, 0.085))
	]),
	asset('wheel-channel', ['shell', 'foot'], [3.6, 1.6], (span, variant) => [
		...row(2 + variant, (t) => panel(0, t * 0.58, 0, 3.2 * span, 0.095, 0.17, 'shell')),
		...row(2, (t) => panel(t * 1.25 * span, 0, 0, 0.22, 1.38, 0.07, 'foot'))
	]),
	asset('cargo-dock', ['foot', 'frame'], [3.8, 2], (span) => [
		...row(2, (t) => panel(0, t * 0.72, 0, 3.35 * span, 0.22, 0.2, 'foot')),
		bow(0, 0.71, 0.2, 2.8 * span, 0.09, 0.64, 'frame'),
		bow(0, -0.71, 0.2, 2.8 * span, 0.09, 0.64, 'frame')
	]),
	asset('kerb-perch', ['frame', 'slats'], [3.6, 1.3], (span) => [
		...row(2, (t) => post(t * 1.32 * span, 0, 0, 0.08, 0.91)),
		rail(
			[
				[-1.42 * span, 0, 0.91],
				[1.42 * span, 0, 0.91]
			],
			0.09,
			'slats'
		),
		rail(
			[
				[-1.32 * span, 0, 0.32],
				[1.32 * span, 0, 0.32]
			],
			0.055
		)
	]),
	asset('cycle-pump-column', ['foot', 'shell', 'frame'], [1.2, 1.4], (span) => [
		post(0, 0, 0, 0.38, 0.13, 'foot'),
		post(0, 0, 0.13, 0.15, 0.59 + span, 'shell'),
		rail(
			[
				[-0.38, 0, 0.73 + span],
				[0.38, 0, 0.73 + span]
			],
			0.045
		),
		rail(
			[
				[0, 0.13, 0.57 + span],
				[0, 0.42, 0.41],
				[0, 0.51, 0.22]
			],
			0.032
		)
	]),
	asset('helmet-cubbies', ['foot', 'shell', 'slats'], [3.6, 1.2], (span, variant) => [
		panel(0, 0, 0, 3.25 * span, 0.82, 0.12, 'foot'),
		...row(3 + variant, (t) => panel(t * 1.45 * span, 0, 0.12, 0.065, 0.72, 1.23, 'shell')),
		...row(3, (_, i) => panel(0, 0, 0.18 + i * 0.55, 3.15 * span, 0.78, 0.065))
	]),
	asset('trail-chicane', ['shell', 'foot'], [3.8, 2.4], (span) => [
		...row(2, (t, i) =>
			bow(t * 0.73 * span, (i - 0.5) * 1.35, 0, 1.72 * span, 0.12, 0.96, 'shell')
		),
		...row(2, (t, i) => panel(t * 0.73 * span, (i - 0.5) * 1.35, 0, 1.9 * span, 0.38, 0.07, 'foot'))
	]),
	asset('lock-ladder', ['frame', 'shell'], [3.8, 1.2], (span, variant) => [
		...row(2, (t) => post(t * 1.52 * span, 0, 0, 0.08, 0.95)),
		...row(2 + variant, (_, i) =>
			rail(
				[
					[-1.52 * span, 0, 0.23 + i * (0.7 / (1 + variant))],
					[1.52 * span, 0, 0.23 + i * (0.7 / (1 + variant))]
				],
				0.043,
				'shell'
			)
		)
	])
];
