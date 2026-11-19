import { family, block, row, shell, pipe } from './assembly';
import { drum, bulb, ring, water, energy, workshop, path, living } from './parts';
import { vessel, glaze } from './pottery';
const asset = family('ceramics', 'deck');
export const sculpturalWare = [
	asset('orb-finial', [2, 2], (factor) => [
		glaze(drum([0, 0, 0], 0.62, 0.3)),
		glaze(bulb([0, 0, 0.3 + 1.15 * factor], 0.88, (1.15 * factor) / 0.88, energy))
	]),
	asset('memphis-portal', [5, 2], (factor) => [
		glaze(shell('arch', 0, 0, 0, 4.4, 1.3, 1 + 3 * factor, 0.42, living)),
		glaze(bulb([1.6, 0, 1 + 3 * factor + 0.4], 0.42, 1, energy))
	]),
	asset('offset-totem', [3, 3], (factor, variant) => [
		glaze(drum([0, 0, 0], 1, 0.3)),
		glaze(block(-0.36, 0, 0.3, 1.25, 1.4, 1.7 * factor, workshop)),
		glaze(ring([0.1, 0, 0.3 + 1.7 * factor + 0.74], 0.84, 0.36, 0.6, water)),
		...Array.from({ length: 1 + variant }, (_, i) =>
			glaze(bulb([0.18, 0, 0.3 + 1.7 * factor + 1.93 + i * 0.72], 0.43, 1, energy))
		)
	]),
	asset('disc-capital', [3, 3], (factor, variant) => [
		glaze(drum([0, 0, 0], 0.52, 0.48)),
		...row(2 + variant, (_, i) =>
			glaze(drum([0, 0, 0.48 + i * 0.18], (0.68 + i * 0.22) * factor, 0.18, i % 2 ? path : living))
		)
	]),
	asset('loop-handle-vase', [3, 3], (factor) => [
		vessel(
			[
				[0.55, 0],
				[0.95, 0.6],
				[0.85, 1.4],
				[0.45, 1.7],
				[0.45, 2.1]
			],
			24,
			factor,
			living
		),
		...row(2, (t) =>
			glaze({ ...ring([0, t * 0.9, 1.05 * factor], 0.48 * factor, 0.33 * factor, 0.16, energy) })
		)
	]),
	asset('zigzag-column', [3, 2], (factor) => [
		glaze(block(0, 0, 0, 2.7, 1.4, 0.3)),
		glaze(
			pipe(
				[
					[-0.6, 0, 0.29],
					[0.82, 0, 1.42 * factor],
					[-0.8, 0, 2.6 * factor],
					[0.8, 0, 3.9 * factor + 0.12]
				],
				0.27,
				workshop
			)
		),
		glaze(drum([0.8, 0, 3.9 * factor], 0.58, 0.24, energy))
	])
];
