import { family, block, row } from './assembly';
import { bulb, rod } from './parts';
const asset = family('gardens', 'facade');
export const verticalGardens = [
	asset('vine-screen', ['body', 'planting'], [0.8, 4], (factor) => [
		...row(5, (t) => block(0.15, t * 1.8, 0, 0.15, 0.07, 3.2)),
		...row(7, (_, i) => rod([0.18, -1.8, i * 0.48 + 0.1], [0.18, 1.8, i * 0.48 + 0.1], 0.06)),
		...row(11, (t, i) =>
			bulb([0.36, t * 1.62, (i % 4) * 0.7 + 0.42], 0.31 * factor, 1.25, 'planting')
		)
	])
];
