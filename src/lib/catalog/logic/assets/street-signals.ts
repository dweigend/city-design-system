import { family, block, row, plate, slope, pipe } from './assembly';
import { drum, bulb, rod, ring, energy, path, pane } from './parts';
const asset = family('street-furniture', 'deck');
export const streetSignals = [
	asset('arm-lamp', [2, 1], (factor) => [
		block(-0.72, 0, 0, 0.2, 0.23, 3.8 * factor),
		block(0, 0, 3.8 * factor, 1.65, 0.27, 0.17),
		block(0.56, 0, 3.8 * factor - 0.05, 0.46, 0.22, 0.05, energy)
	]),
	asset('light-bollard', [0.7, 0.7], (factor) => [
		block(0, 0, 0, 0.52, 0.52, 1.35 * factor),
		block(0, 0, 1.35 * factor, 0.49, 0.49, 0.28, energy),
		slope(0, 0, 1.35 * factor + 0.28, 0.62, 0.62, 0.14)
	]),
	asset('sign-gantry', [5, 1], (factor) => [
		...row(2, (t) => drum([t * 2.25, 0, 0], 0.08, 3.5 * factor)),
		rod([-2.25, 0, 3.5 * factor], [2.25, 0, 3.5 * factor], 0.07),
		...row(3, (t) => block(t * 1.3, 0, 3.5 * factor - 0.47, 1.06, 0.15, 0.48, t ? path : energy))
	]),
	asset('map-desk', [2, 1], (factor) => [
		block(0, 0, 0, 1.6, 0.56, 0.8 * factor),
		slope(0, 0, 0.8 * factor, 0.8, 1.8, 0.55, Math.PI / 2, pane)
	]),
	asset('street-clock', [1.4, 1.4], (factor) => [
		...row(2, (t) => drum([0, t * 0.17, 0], 0.055, 2.9 * factor)),
		ring([0, 0, 2.9 * factor + 0.39], 0.56, 0, 0.16),
		rod([0.1, 0, 2.9 * factor + 0.39], [0.1, 0.23, 2.9 * factor + 0.52], 0.025, path),
		rod([0.1, 0, 2.9 * factor + 0.39], [0.1, 0, 2.9 * factor + 0.75], 0.022, path)
	]),
	asset('poster-drum', [1.8, 1.8], (factor) => [
		drum([0, 0, 0], 0.82, 0.16),
		drum([0, 0, 0.16], 0.72, 2.4 * factor, pane),
		drum([0, 0, 2.4 * factor + 0.16], 0.82, 0.2)
	]),
	asset('light-gate', [4, 1], (factor) => [
		...row(2, (t) => rod([t * 1.85, 0, 0.06], [t * 1.45, 0, 2.9 * factor], 0.08)),
		block(0, 0, 2.9 * factor, 3.1, 0.23, 0.16, energy)
	]),
	asset('corner-lamp', [1, 1], (factor) => [
		plate(
			[
				[-0.45, -0.45],
				[0.45, -0.45],
				[-0.45, 0.45]
			],
			0,
			1.5 * factor
		),
		plate(
			[
				[-0.45, -0.45],
				[0.45, -0.45],
				[-0.45, 0.45]
			],
			1.5 * factor,
			0.55,
			pane
		)
	]),
	asset('festoon', [7, 1], (factor, variant) => [
		...row(2, (t) => drum([t * 3.3, 0, 0], 0.08, 3.5 * factor)),
		pipe(
			Array.from({ length: 17 }, (_, i) => [
				((i - 8) * 3.3) / 8,
				0,
				(3.05 + 0.45 * ((i - 8) / 8) ** 2) * factor
			]),
			0.025
		),
		...row(5 + variant, (t) =>
			bulb([t * 2.8, 0, (3.05 + 0.45 * ((t * 2.8) / 3.3) ** 2) * factor - 0.1], 0.13, 1.1, energy)
		)
	]),
	asset('tactile-turn', [3, 3], (factor, variant) => [
		...row(2 + 2 * variant, (_, i) =>
			pipe(
				[
					[-1.3, -1.1 + i * 0.12, 0.065],
					[-0.2, -1.1 + i * 0.12, 0.065],
					[0.75 - i * 0.12, -0.2, 0.065],
					[0.75 - i * 0.12, 1.3 * factor, 0.065]
				],
				0.055,
				energy
			)
		)
	])
];
