import { family, block, legs, row, plate, circle, crescent, shell, slope, pipe } from './assembly';
import { drum, rod, cap, surface, white, water, energy, path, living } from './parts';
const asset = family('playgrounds', 'deck');
export const playgrounds = [
	asset('climb-arches', [5, 5], (factor) => [
		...row(3, (t, i) =>
			shell('vault', t * 0.55, t * 1.57, 0, 3.4, 0.7, (1.3 + i * 0.36) * factor, 0.24)
		),
		...row(2, (t) => rod([t * 0.6, -1.5, 1.14 * factor], [t * 0.6, 1.52, 1.74 * factor], 0.075))
	]),
	asset('play-swing', [5, 2], (factor) => [
		...row(2, (t) =>
			pipe(
				[
					[t * 2, -0.85, 0.07],
					[t * 2, 0, 2.8 * factor],
					[t * 2, 0.85, 0.07]
				],
				0.1,
				energy
			)
		),
		rod([-2, 0, 2.8 * factor], [2, 0, 2.8 * factor], 0.1),
		...row(2, (t) => block(t * 0.91, 0, 0.52, 0.86, 0.47, 0.09, living)),
		...row(4, (_, i) =>
			rod(
				[[-1.28, -0.54, 0.54, 1.28][i], 0, 0.59],
				[[-1.28, -0.54, 0.54, 1.28][i], 0, 2.8 * factor],
				0.024
			)
		)
	]),
	asset('sand-canopy', [5, 5], (factor) => [
		drum([0, 0, 0], 2.2, 0.16, energy),
		crescent(2.25, 2.08, 0, 0.32, 1.94 * Math.PI, living),
		drum([-0.85, 0, 0.16], 0.12, 2.4 * factor),
		cap([-0.85, 0, 0.16 + 2.4 * factor], 1.55, 0.3)
	]),
	asset('chute-slide', [5, 2], (factor) => [
		slope(0, 0, 0, 4.2, 1.15, 1.8 * factor, 0, living),
		...row(2, (t) => rod([-2.1, t * 0.55, 1.8 * factor + 0.12], [2.1, t * 0.55, 0.18], 0.08)),
		...row(5, (_, i) => block(-2.29, 0, i * 0.34 * factor, 0.34, 0.8, 0.11))
	]),
	asset('ping-table', [3, 2], (factor) => [
		...legs(1.1, 0.61, 0.76, 0.055),
		block(0, 0, 0.76, 2.74, 1.52, 0.09, water),
		block(0, 0, 0.85, 0.025, 1.63, 0.21 * factor)
	]),
	asset('play-bars', [4, 2], (factor) => [
		...row(2, (t) => drum([t * 1.55, 0, 0], 0.11, 2.55 * factor, energy)),
		...row(4, (_, i) =>
			rod([-1.55, 0, (0.52 + i * 0.64) * factor], [1.55, 0, (0.52 + i * 0.64) * factor], 0.045)
		)
	]),
	asset('rope-dome', [5, 5], (factor) => [
		...row(5, (_, i) => ({
			...shell('vault', 0, 0, 0, 4.3, 0.12, 2.8 * factor, 0.14, energy),
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
	asset('skate-ramp', [5, 3], (factor) => [
		slope(0, 0, 0, 4.4, 2.6, 1.65 * factor),
		block(-2.32, 0, 0, 0.24, 2.6, 1.65 * factor),
		rod([-2.18, -1.27, 1.65 * factor], [-2.18, 1.27, 1.65 * factor], 0.055)
	]),
	asset('jump-bed', [3, 3], (factor) => [
		plate(circle(1.4), 0, 0.15, white, circle(1.1 * factor).reverse()),
		drum([0, 0, 0.05], 1.09 * factor, 0.06, path)
	])
];
