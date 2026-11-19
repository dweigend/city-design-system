import { family, block, row } from './assembly';
import { bulb, rod, ring } from './parts';
const asset = family('house-bodies', 'facade');
export const houseProjections = [
	asset('cantilever-room', ['accent', 'body', 'glass'], [4, 5], (factor) => [
		block(1.9, 0, 0.65, 3.8, 4.8 * factor, 2.5, 'accent'),
		...row(2, (t) => rod([0.18, t * 1.7 * factor, 0.18], [3.65, t * 1.7 * factor, 0.65], 0.15)),
		block(3.82, 0, 1.4, 0.08, 3.9 * factor, 1, 'glass')
	]),
	asset('display-bay', ['body', 'glass'], [1.8, 4], (factor) => [
		block(0.85, 0, 0, 1.7, 3.8 * factor, 0.2),
		block(0.8, 0, 0.2, 1.55, 3.55 * factor, 2.1, 'glass'),
		block(0.85, 0, 2.3, 1.7, 3.8 * factor, 0.18)
	]),
	asset('garden-loggia', ['body', 'planting'], [2.1, 6], (factor) => [
		block(1, 0, 0, 2, 5.8 * factor, 0.18),
		...row(2, (t) => block(1, t * 2.75 * factor, 0.18, 2, 0.18, 2.7)),
		block(1, 0, 2.88, 2, 5.8 * factor, 0.2),
		block(1.77, 0, 0.18, 0.45, 5.5 * factor, 0.58, 'planting')
	]),
	asset('capsule-socket', ['body', 'trim'], [1.5, 4], (factor) => [
		ring([0.65, 0, 1.85 * factor], 1.8 * factor, 1.47 * factor, 1.3),
		ring([1.32, 0, 1.85 * factor], 1.83 * factor, 1.54 * factor, 0.16, 'trim')
	]),
	asset('window-reveal', ['body'], [0.65, 4], (factor) => [
		...row(2, (t) => block(0.3, t * 1.7 * factor, 0, 0.6, 0.2, 2.4)),
		...row(2, (_, i) => block(0.3, 0, i * 2.25, 0.6, 3.4 * factor, 0.15))
	]),
	asset('mullion-grid', ['glass', 'body'], [0.35, 6], (factor, variant) => [
		block(0.08, 0, 0, 0.16, 5.8, 3.4, 'glass'),
		...row(4 + variant, (t) => block(0.2, t * 2.82, 0, 0.13, 0.08, 3.4)),
		block(0.22, 0, 2.4 * factor, 0.15, 5.8, 0.09)
	]),
	asset('window-planter', ['accent', 'planting'], [0.75, 4], (factor, variant) => [
		block(0.35, 0, 0, 0.7, 3.8 * factor, 0.45, 'accent'),
		...row(5 + variant, (t) => bulb([0.35, t * 1.55 * factor, 0.48], 0.27, 0.75, 'planting'))
	])
];
