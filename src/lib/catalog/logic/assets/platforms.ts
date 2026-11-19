import { family, block, legs, row, plate, circle } from './assembly';
import { drum, bulb, white, food, workshop, path } from './parts';
const asset = family('structure', 'deck');
export const platforms = [
	asset('floor-plate', [8, 6], (factor, variant) => [
		block(0, 0, 0, 7.8, 5.8, 0.48 * factor),
		...row(4 + variant, (t) => block(t * 2.9, 0, 0.48 * factor, 0.15, 5.8, 0.055))
	]),
	asset('stilt-table', [8, 6], (factor) => [
		...legs(3.4, 2.4, 4.8 * factor),
		block(0, 0, 4.8 * factor, 7.8, 5.8, 0.35)
	]),
	asset('annular-floor', [8, 8], (factor) => [
		plate(circle(3.9), 0, 0.46 * factor, white, circle(1.7 * factor).reverse())
	]),
	asset('disc-deck', [7, 7], (factor) => [
		drum([0, 0, 0], 1.1, 1.5 * factor),
		drum([0, 0, 1.5 * factor], 3.4, 0.35)
	]),
	asset('orchard-deck', [8, 6], (factor) => [
		block(0, 0, 0, 7.8, 5.8, 0.36),
		...row(3, (t) => block(t * 2.55, 0, 0.36, 1.7, 4.8, 0.45, food)),
		...row(3, (t) => drum([t * 2.55, 0, 0.81], 0.14, 1.7 * factor)),
		...row(3, (t) => bulb([t * 2.55, 0, 0.81 + 1.7 * factor], 0.87, 0.85, food))
	]),
	asset('fork-deck', [8, 6], (factor) => [
		plate(
			[
				[-1, -3],
				[1, -3],
				[1, -0.6],
				[3.9, 1.8],
				[2.7, 2.9],
				[0, 0.75],
				[-2.7, 2.9],
				[-3.9, 1.8],
				[-1, -0.6]
			],
			0,
			0.5 * factor,
			path
		)
	]),
	asset('cross-deck', [7, 7], (factor) => [
		block(0, 0, 0, 6.9, 1.7 * factor, 0.36, path),
		...row(2, (t) =>
			block(0, t * (1.725 + 0.425 * factor), 0, 1.7 * factor, 3.45 - 0.85 * factor, 0.36, path)
		)
	]),
	asset('transfer-plinth', [5, 5], (factor) => [
		plate(circle(2.4, 8), 0, 0.65 * factor),
		...row(2, (t) => block(0, t * 1.25, 0.65 * factor, 3.5, 0.38, 0.2, workshop))
	])
];
