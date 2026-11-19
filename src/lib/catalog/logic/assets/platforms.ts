import { family, block, legs, row, plate, circle } from './assembly';
import { drum } from './parts';
import { panel } from './objects/forms';
import { castPlinth } from './production/cast-panel';
import { treeCrown } from './production/tree-crown';
const asset = family('structure', 'deck');
export const platforms = [
	asset('floor-plate', ['body'], [8, 6], (factor) => [castPlinth(7.8, 5.8, 0.7 * factor, 'body')]),
	asset('stilt-table', ['body'], [8, 6], (factor) => [
		...legs(3.4, 2.4, 4.8 * factor),
		block(0, 0, 4.8 * factor, 7.8, 5.8, 0.35)
	]),
	asset('annular-floor', ['body'], [8, 8], (factor) => [
		plate(circle(3.9), 0, 0.46 * factor, 'body', circle(1.7 * factor).reverse())
	]),
	asset('disc-deck', ['body'], [7, 7], (factor) => [
		drum([0, 0, 0], 1.1, 1.5 * factor),
		drum([0, 0, 1.5 * factor], 3.4, 0.35)
	]),
	asset('orchard-deck', ['body', 'planting'], [8, 6], (factor, variant) => [
		castPlinth(7.8, 5.8, 0.44, 'body'),
		panel(0, 0, 0.44, 7.32, 5.32, 0.22, 'planting'),
		...Array.from({ length: 2 + variant }, (_, i) => {
			const x = -2.34 + (4.68 * i) / (1 + variant);
			return treeCrown(
				'blocks',
				[x, i % 2 ? 1.04 : -1.04, 0.66],
				1.08 + 0.3 * factor,
				variant,
				i * 0.23,
				'body'
			);
		}).flat()
	]),
	asset('fork-deck', ['deck'], [8, 6], (factor) => [
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
			'deck'
		)
	]),
	asset('cross-deck', ['deck'], [7, 7], (factor) => [
		block(0, 0, 0, 6.9, 1.7 * factor, 0.36 * factor, 'deck'),
		...row(2, (t) =>
			block(
				0,
				t * (1.725 + 0.425 * factor),
				0,
				1.7 * factor,
				3.45 - 0.85 * factor,
				0.36 * factor,
				'deck'
			)
		)
	]),
	asset('transfer-plinth', ['body', 'trim'], [5, 5], (factor) => [
		plate(circle(2.4, 8), 0, 0.65 * factor),
		...row(2, (t) => block(0, t * 1.25, 0.65 * factor, 3.5, 0.38, 0.2, 'trim'))
	])
];
