import { family, block, row, pipe } from './assembly';
import { ring, water } from './parts';
const asset = family('waterworks', 'facade');
export const rainFittings = [
	asset('wall-cistern', [1.1, 3.4], (factor) => [
		block(0.49, 0, 0, 0.98, 2.8, 2.1 * factor, water),
		pipe(
			[
				[0.82, 1.3, 1.95 * factor],
				[0.82, 1.43, 1.95 * factor],
				[0.82, 1.43, 0.28]
			],
			0.06
		)
	]),
	asset('overflow-spout', [1.6, 1], (factor) => [
		pipe(
			[
				[0.1, 0, 1.1 * factor],
				[0.8 * factor, 0, 1.1 * factor],
				[1.36 * factor, 0, 0.83 * factor]
			],
			0.14,
			water
		),
		ring([0.1, 0, 1.1 * factor], 0.32, 0.14, 0.2)
	]),
	asset('rain-leader', [0.8, 1], (factor) => [
		pipe(
			[
				[0.2, 0, 3.6 * factor],
				[0.42, 0, 3.26 * factor],
				[0.42, 0, 0.38],
				[0.64, 0, 0.2]
			],
			0.11,
			water
		),
		...row(3, (_, i) => block(0.22, 0, 0.65 + i * factor, 0.44, 0.31, 0.08))
	])
];
