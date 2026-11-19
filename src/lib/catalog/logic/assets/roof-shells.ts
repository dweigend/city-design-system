import { family, block, legs, row, plate, circle, slope } from './assembly';
import { drum, ring, cap, surface } from './parts';
const asset = family('roof-pieces', 'roof');
export const roofShells = [
	asset('ridge-roof', ['accent'], [6, 6], (factor) => [
		slope(-1.5, 0, 0, 3, 5.8, 2 * factor, Math.PI, 'accent'),
		slope(1.5, 0, 0, 3, 5.8, 2 * factor, 0, 'accent')
	]),
	asset('split-gable', ['body'], [6, 5], (factor) => [
		slope(-1.5, 0.35, 0, 3, 4, 2.5 * factor, Math.PI),
		slope(1.5, -0.35, 0, 3, 4, 1.7 * factor)
	]),
	asset('shed-cap', ['accent'], [6, 5], (factor) => [
		slope(0, 0, 0, 5.8, 4.8, 2.2 * factor, 0, 'accent')
	]),
	asset('butterfly-roof', ['body'], [7, 5], (factor) => [
		slope(-1.7, 0, 0, 3.4, 4.8, 1.5 * factor),
		slope(1.7, 0, 0, 3.4, 4.8, 1.5 * factor, Math.PI)
	]),
	asset('folded-canopy', ['body', 'accent'], [8, 5], (factor) => [
		...row(6, (_, i) =>
			slope(
				-3.25 + i * 1.3,
				0,
				0,
				1.3,
				4.8,
				1.4 * factor,
				i % 2 ? 0 : Math.PI,
				i % 2 ? 'accent' : 'body'
			)
		)
	]),
	asset('geodesic-cap', ['glass'], [7, 7], (factor, variant) => [
		{
			...surface('glass'),
			kind: 'dome',
			position: [0, 0, 0],
			radius: 3.3 * factor,
			height: 2.8,
			facets: 1 + variant
		}
	]),
	asset('saddle-canopy', ['body', 'accent'], [6, 6], (factor) => [
		...legs(2.8, 2.8, 2.4 * factor, 0.08),
		...row(2, (t) => drum([t * 2.8, t * 2.8, 2.4 * factor], 0.08, 1.2)),
		{
			...surface('accent'),
			kind: 'membrane',
			corners: [
				[-2.8, -2.8, 2.4 * factor + 1.2],
				[2.8, -2.8, 2.4 * factor],
				[2.8, 2.8, 2.4 * factor + 1.2],
				[-2.8, 2.8, 2.4 * factor]
			],
			sag: 0.12
		}
	]),
	asset('spire-cap', ['body', 'accent'], [3, 3], (factor, variant) => [
		plate(circle(1.45, 4 + variant), 0, 0.22),
		{ ...surface('accent'), kind: 'cone', position: [0, 0, 0.22], radius: 1.36, height: 4 * factor }
	]),
	asset('pin-crown', ['body', 'highlight'], [5, 5], (factor, variant) => [
		plate(circle(2.4, 8), 0, 0.23),
		...circle(2.05, 8 + variant * 2).map(([x, y], i) =>
			drum([x, y, 0.23], 0.08, (1.3 + (i % 2) * 0.6) * factor, 'highlight')
		)
	]),
	asset('service-hood', ['body', 'highlight'], [3.5, 3.5], (factor) => [
		drum([0, 0, 0], 1.5, 0.8),
		cap([0, 0, 0.8], 1.55, 1.5 * factor),
		ring([1.47, 0, 0.67], 0.34, 0.25, 0.15, 'highlight')
	]),
	asset('vent-box', ['body', 'glass'], [3, 2], (factor, variant) => [
		block(0, 0, 0, 2.8, 1.8, 1.55 * factor),
		...row(5 + variant, (t) => block(t * 1.16, -0.92, 0.28, 0.12, 0.08, 1.05 * factor, 'glass'))
	]),
	asset('clerestory', ['glass', 'body'], [5, 3], (factor) => [
		block(0, 0, 0, 4.8, 2.7, 0.55, 'glass'),
		slope(0, 0, 0.55, 2.7, 4.8, 1.2 * factor, Math.PI / 2)
	]),
	asset('ridge-lantern', ['body', 'glass'], [3, 3], (factor) => [
		plate(circle(1.4, 8), 0, 0.2),
		plate(circle(1.13, 8), 0.2, 1.5 * factor, 'glass'),
		cap([0, 0, 0.2 + 1.5 * factor], 1.35, 0.65)
	]),
	asset('cowl-vent', ['body', 'glass'], [2, 2], (factor) => [
		drum([0, 0, 0], 0.55, 1.5 * factor),
		cap([0, 0, 1.5 * factor], 0.94, 0.6),
		...row(3, (_, i) => drum([0, 0, 1.5 * factor - 0.2 * i], 0.63, 0.06, 'glass'))
	])
];
