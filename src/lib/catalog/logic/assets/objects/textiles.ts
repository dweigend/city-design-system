import { suggestions } from './suggestions';
import { family, row, circle } from '../assembly';
import { panel, post, rail, eye, collar } from './forms';
import { sail } from './fabric';

const asset = family('textiles', 'deck', suggestions);
export const textiles = [
	asset('court-hammock', ['slats', 'frame', 'fabric'], [4.7, 1.7], (span) => [
		...row(2, (t) => post(t * 1.97 * span, 0, 0, 0.105, 1.46, 'slats')),
		...row(2, (t) =>
			rail(
				[
					[t * 1.97 * span, 0, 1.39],
					[t * 1.5 * span, -0.48, 1.11]
				],
				0.028
			)
		),
		...row(2, (t) =>
			rail(
				[
					[t * 1.97 * span, 0, 1.39],
					[t * 1.5 * span, 0.48, 1.11]
				],
				0.028
			)
		),
		sail(
			[
				[-1.5 * span, -0.48, 1.11],
				[1.5 * span, -0.48, 1.11],
				[1.5 * span, 0.48, 1.11],
				[-1.5 * span, 0.48, 1.11]
			],
			0.49
		)
	]),
	asset('crossbar-banner', ['frame', 'fabric'], [4.2, 1.2], (span) => [
		...row(2, (t) => post(t * 1.78 * span, 0, 0, 0.065, 2.96)),
		rail(
			[
				[-1.78 * span, 0, 2.87],
				[1.78 * span, 0, 2.87]
			],
			0.05
		),
		sail(
			[
				[-1.53 * span, 0, 2.82],
				[1.53 * span, 0, 2.82],
				[1.53 * span, 0.13, 1.61],
				[-1.53 * span, 0.13, 1.61]
			],
			0.05
		)
	]),
	asset('swallow-flag', ['foot', 'frame', 'fabric'], [3, 1.4], (span) => [
		post(-0.85, 0, 0, 0.28, 0.14, 'foot'),
		post(-0.85, 0, 0.14, 0.055, 2.83),
		sail(
			[
				[-0.85, 0, 2.84],
				[-0.85, 0, 1.94],
				[1.8 * span - 0.85, 0.29, 2.13],
				[1.8 * span - 0.85, 0.29, 2.7]
			],
			0.06
		)
	]),
	asset('festival-streamers', ['frame', 'fabric'], [3.9, 1.6], (_span, variant) => [
		...row(2, (t) => post(t * 1.69, 0, 0, 0.055, 2.69)),
		rail(
			[
				[-1.69, 0, 2.67],
				[1.69, 0, 2.67]
			],
			0.03
		),
		...row(3 + variant * 2, (t, i) =>
			sail(
				[
					[t * 1.32 - 0.12, 0, 2.64],
					[t * 1.32 + 0.12, 0, 2.64],
					[t * 1.32 + 0.095, 0.12, 1.42 + (i % 2) * 0.32],
					[t * 1.32 - 0.095, 0.12, 1.42 + (i % 2) * 0.32]
				],
				0.045
			)
		)
	]),
	asset('screen-curtain', ['slats', 'frame', 'fabric'], [4, 1.5], (span) => [
		...row(2, (t) => post(t * 1.7 * span, 0, 0, 0.085, 2.35, 'slats')),
		rail(
			[
				[-1.7 * span, 0, 2.33],
				[1.7 * span, 0, 2.33]
			],
			0.05
		),
		...row(3, (_, i) =>
			sail(
				[
					[(i - 1.5) * 1.08 * span, 0, 2.28],
					[(i - 0.5) * 1.08 * span, 0, 2.28],
					[(i - 0.5) * 1.08 * span, 0.11, 0.42],
					[(i - 1.5) * 1.08 * span, 0.11, 0.42]
				],
				0.06
			)
		)
	]),
	asset('ring-pennant', ['foot', 'frame', 'shell', 'fabric'], [1.9, 1.9], (span) => [
		post(0, 0, 0, 0.32, 0.13, 'foot'),
		post(0, 0, 0.13, 0.06, 0.98 + span),
		eye(0, 0, 1.58 + span, 0.5, 0.045, 0.09),
		sail(
			[
				[0, -0.32, 1.89 + span],
				[0, 0.32, 1.89 + span],
				[0.1, 0.21, 1.32 + span],
				[0.1, -0.21, 1.32 + span]
			],
			0.05
		)
	]),
	asset('sling-bench', ['slats', 'fabric'], [3.4, 1.5], (span) => [
		...row(2, (t) => panel(t * 1.31 * span, 0, 0, 0.14, 0.91, 0.74, 'slats')),
		sail(
			[
				[-1.31 * span, -0.41, 0.72],
				[1.31 * span, -0.41, 0.72],
				[1.31 * span, 0.41, 0.72],
				[-1.31 * span, 0.41, 0.72]
			],
			0.28
		)
	]),
	asset('woven-windsock', ['foot', 'frame', 'fabric'], [3.4, 1.7], (span) => [
		post(-1.18, 0, 0, 0.28, 0.13, 'foot'),
		post(-1.18, 0, 0.13, 0.055, 2.42),
		eye(-1.18, 0, 2.37, 0.28, 0.04, 0.06, 'frame'),
		...row(4, (_, i) =>
			sail(
				[
					[-1.18, 0.28 * Math.cos((i * Math.PI) / 2), 2.37 + 0.28 * Math.sin((i * Math.PI) / 2)],
					[
						-1.18,
						0.28 * Math.cos(((i + 1) * Math.PI) / 2),
						2.37 + 0.28 * Math.sin(((i + 1) * Math.PI) / 2)
					],
					[
						2.42 * span - 1.18,
						0.13 * Math.cos(((i + 1) * Math.PI) / 2),
						2.12 + 0.13 * Math.sin(((i + 1) * Math.PI) / 2)
					],
					[
						2.42 * span - 1.18,
						0.13 * Math.cos((i * Math.PI) / 2),
						2.12 + 0.13 * Math.sin((i * Math.PI) / 2)
					]
				],
				0.04
			)
		)
	]),
	asset('pleated-wall', ['frame', 'fabric'], [4, 1.6], (_span, variant) => [
		...row(3 + variant, (t) =>
			post(t * 1.7, ((Math.round(((t + 1) * (2 + variant)) / 2) % 2) - 0.5) * 0.58, 0, 0.06, 1.8)
		),
		...Array.from({ length: 2 + variant }, (_, i) =>
			sail(
				[
					[-1.7 + (3.4 * i) / (2 + variant), ((i % 2) - 0.5) * 0.58, 1.77],
					[-1.7 + (3.4 * (i + 1)) / (2 + variant), (((i + 1) % 2) - 0.5) * 0.58, 1.77],
					[-1.7 + (3.4 * (i + 1)) / (2 + variant), (((i + 1) % 2) - 0.5) * 0.58, 0.18],
					[-1.7 + (3.4 * i) / (2 + variant), ((i % 2) - 0.5) * 0.58, 0.18]
				],
				0.03
			)
		)
	]),
	asset('lantern-cloth', ['foot', 'frame', 'fabric'], [2.1, 2.1], (_span, variant) => [
		post(0, 0, 0, 0.37, 0.12, 'foot'),
		post(0, 0, 0.12, 0.055, 2.36),
		collar(0, 0, 2.31, 0.68, 0.055, 0.06, 'frame'),
		...circle(0.62, 3 + variant).map(([x, y]) =>
			sail(
				[
					[x - 0.13, y, 2.32],
					[x + 0.13, y, 2.32],
					[x + 0.1, y + 0.1, 1.56],
					[x - 0.1, y + 0.1, 1.56]
				],
				0.06
			)
		)
	])
];
