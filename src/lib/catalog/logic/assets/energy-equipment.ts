import { family, block, legs, row, pipe } from './assembly';
import { drum, rod, ring, energy, pane } from './parts';
const asset = family('neighbourhood-services', 'deck');
export const energyEquipment = [
	asset('solar-port', [5, 4], (factor) => [
		...legs(2.2, 1.65, 2.7 * factor),
		block(0, 0, 2.7 * factor, 4.8, 3.8, 0.16),
		...row(5, (t) => block(t * 0.94 * 2, 0, 2.7 * factor + 0.16, 0.87, 3.59, 0.06, pane))
	]),
	asset('solar-tree', [4, 3], (factor) => [
		drum([0, 0, 0], 0.17, 3 * factor),
		...row(4, (t, i) =>
			rod([0, 0, (1.4 + i * 0.33) * factor], [t * 1.42, 0, (2.2 + i * 0.32) * factor], 0.07)
		),
		...row(4, (t, i) => block(t * 1.42, 0, (2.2 + i * 0.32) * factor, 0.85, 2.6, 0.11, pane))
	]),
	asset('charge-post', [1.4, 1], (factor) => [
		block(-0.16, 0, 0, 0.78, 0.72, 1.82 * factor),
		block(-0.16, -0.37, 1.08 * factor, 0.54, 0.05, 0.35, pane),
		pipe(
			[
				[0.22, 0, 1.4 * factor],
				[0.49, 0, 1.23 * factor],
				[0.54, 0, 0.45],
				[0.29, 0, 0.54],
				[0.26, 0, 0.88 * factor]
			],
			0.043
		)
	]),
	asset('utility-cabinet', [2, 1.6], (factor) => [
		block(0, 0, 0, 1.8, 1.4, 1.85 * factor),
		...row(2, (t) => block(t * 0.42, -0.72, 0.1, 0.79, 0.07, 1.58 * factor, pane)),
		block(0, 0, 1.85 * factor, 1.95, 1.54, 0.12)
	]),
	asset('ring-beacon', [2, 3], (factor) => [
		block(0, 0, 0, 0.8, 1.2, 0.38),
		ring([0, 0, 1.4 * factor + 0.32], 1.4 * factor, 1.18 * factor, 0.34, energy),
		ring([0.16, 0, 1.4 * factor + 0.32], 1.31 * factor, 1.22 * factor, 0.06, pane)
	])
];
