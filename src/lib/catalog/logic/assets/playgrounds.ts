import { skateTransition } from './skate-transition';
import { family, block, legs, row, plate, circle, crescent, shell, slope, pipe } from './assembly';
import { drum, rod, cap, surface } from './parts';
const asset = family('playgrounds', 'deck');
export const playgrounds = [
	asset('climb-arches', ['body'], [5, 5], (factor) => [
		...row(3, (t, i) =>
			shell('vault', t * 0.55, t * 1.57, 0, 3.4, 0.7, (1.3 + i * 0.36) * factor, 0.24)
		),
		...row(2, (t) => rod([t * 0.6, -1.5, 1.14 * factor], [t * 0.6, 1.52, 1.74 * factor], 0.075))
	]),
	asset('play-swing', ['highlight', 'body', 'accent'], [5, 2], (factor) => [
		...row(2, (t) =>
			pipe(
				[
					[t * 2, -0.85, 0.07],
					[t * 2, 0, 2.8 * factor],
					[t * 2, 0.85, 0.07]
				],
				0.1,
				'highlight'
			)
		),
		rod([-2, 0, 2.8 * factor], [2, 0, 2.8 * factor], 0.1),
		...row(2, (t) => block(t * 0.91, 0, 0.52, 0.86, 0.47, 0.09, 'accent')),
		...row(4, (_, i) =>
			rod(
				[[-1.28, -0.54, 0.54, 1.28][i], 0, 0.59],
				[[-1.28, -0.54, 0.54, 1.28][i], 0, 2.8 * factor],
				0.06
			)
		)
	]),
	asset('sand-canopy', ['highlight', 'accent', 'body'], [5, 5], (factor) => [
		drum([0, 0, 0], 2.2, 0.16, 'highlight'),
		crescent(2.25, 2.08, 0, 0.32, 1.94 * Math.PI, 'accent'),
		drum([-0.85, 0, 0.16], 0.12, 2.4 * factor),
		cap([-0.85, 0, 0.16 + 2.4 * factor], 1.55, 0.3)
	]),
	asset('chute-slide', ['accent', 'body'], [5, 2], (factor) => [
		slope(0, 0, 0, 4.2, 1.15, 1.8 * factor, 0, 'accent'),
		...row(2, (t) => rod([-2.1, t * 0.55, 1.8 * factor + 0.12], [2.1, t * 0.55, 0.18], 0.08)),
		...row(5, (_, i) => block(-2.29, 0, i * 0.34 * factor, 0.34, 0.8, 0.11))
	]),
	asset('ping-table', ['body', 'channel'], [3, 2], (factor) => [
		...legs(1.1 * factor, 0.61, 0.76, 0.055),
		block(0, 0, 0.76, 2.74 * factor, 1.52, 0.09, 'channel'),
		block(0, 0, 0.85, 0.025, 1.63, 0.21 * factor)
	]),
	asset('play-bars', ['highlight', 'body'], [4, 2], (factor) => [
		...row(2, (t) => drum([t * 1.55, 0, 0], 0.11, 2.55 * factor, 'highlight')),
		...row(4, (_, i) =>
			rod([-1.55, 0, (0.52 + i * 0.64) * factor], [1.55, 0, (0.52 + i * 0.64) * factor], 0.06)
		)
	]),
	asset('rope-dome', ['highlight', 'body'], [5, 5], (factor) => [
		...row(5, (_, i) => ({
			...shell('vault', 0, 0, 0, 4.3, 0.12, 2.8 * factor, 0.14, 'highlight'),
			rotation: (i * Math.PI) / 5
		})),
		...row(3, (_, i) => ({
			...surface(),
			kind: 'torus',
			position: [0, 0, (i + 1) * 0.65 * factor],
			radius: 2.15 * Math.sqrt(1 - (((i + 1) * 0.65) / 2.8) ** 2),
			tube: 0.034,
			axis: 'z'
		}))
	]),
	asset('skate-ramp', ['body'], [5, 3], skateTransition),
	asset('jump-bed', ['body', 'highlight', 'deck'], [3, 3], (factor, variant) => [
		plate(circle(1.4, 4 + 2 * variant), 0, 0.15, 'body', circle(1.1 * factor).reverse()),
		...circle(1.22, 4 + 2 * variant).map(([x, y]) => drum([x, y, 0.15], 0.08, 0.08, 'highlight')),
		drum([0, 0, 0.05], 1.09 * factor, 0.06, 'deck')
	])
];
