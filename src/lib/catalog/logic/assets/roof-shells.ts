import { family, block, legs, row, plate, circle, slope } from './assembly';
import { drum, ring, cap, surface, white, energy, living, pane } from './parts';
const asset = family('roof-pieces', 'roof');
export const roofShells = [
	asset('ridge-roof', [6, 6], (factor) => [
		slope(-1.5, 0, 0, 3, 5.8, 2 * factor, Math.PI, living),
		slope(1.5, 0, 0, 3, 5.8, 2 * factor, 0, living)
	]),
	asset('split-gable', [6, 5], (factor) => [
		slope(-1.5, 0.35, 0, 3, 4, 2.5 * factor, Math.PI),
		slope(1.5, -0.35, 0, 3, 4, 1.7 * factor)
	]),
	asset('shed-cap', [6, 5], (factor) => [slope(0, 0, 0, 5.8, 4.8, 2.2 * factor, 0, living)]),
	asset('butterfly-roof', [7, 5], (factor) => [
		slope(-1.7, 0, 0, 3.4, 4.8, 1.5 * factor),
		slope(1.7, 0, 0, 3.4, 4.8, 1.5 * factor, Math.PI)
	]),
	asset('folded-canopy', [8, 5], (factor) => [
		...row(6, (_, i) =>
			slope(
				-3.25 + i * 1.3,
				0,
				0,
				1.3,
				4.8,
				1.4 * factor,
				i % 2 ? 0 : Math.PI,
				i % 2 ? living : white
			)
		)
	]),
	asset('geodesic-cap', [7, 7], (factor, variant) => [
		{
			...surface(pane),
			kind: 'dome',
			position: [0, 0, 0],
			radius: 3.3 * factor,
			height: 2.8,
			facets: 1 + variant
		}
	]),
	asset('saddle-canopy', [6, 6], (factor) => [
		...legs(2.8, 2.8, 2.4 * factor, 0.08),
		...row(2, (t) => drum([t * 2.8, t * 2.8, 2.4 * factor], 0.08, 1.2)),
		{
			...surface(living),
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
	asset('spire-cap', [3, 3], (factor, variant) => [
		plate(circle(1.45, 4 + variant), 0, 0.22),
		{ ...surface(living), kind: 'cone', position: [0, 0, 0.22], radius: 1.36, height: 4 * factor }
	]),
	asset('pin-crown', [5, 5], (factor, variant) => [
		plate(circle(2.4, 8), 0, 0.23),
		...circle(2.05, 8 + variant * 2).map(([x, y], i) =>
			drum([x, y, 0.23], 0.08, (1.3 + (i % 2) * 0.6) * factor, energy)
		)
	]),
	asset('service-hood', [3.5, 3.5], (factor) => [
		drum([0, 0, 0], 1.5, 0.8),
		cap([0, 0, 0.8], 1.55, 1.5 * factor),
		ring([1.47, 0, 0.67], 0.34, 0.25, 0.15, energy)
	]),
	asset('vent-box', [3, 2], (factor, variant) => [
		block(0, 0, 0, 2.8, 1.8, 1.55 * factor),
		...row(5 + variant, (t) => block(t * 1.16, -0.92, 0.28, 0.12, 0.08, 1.05 * factor, pane))
	]),
	asset('clerestory', [5, 3], (factor) => [
		block(0, 0, 0, 4.8, 2.7, 0.55, pane),
		slope(0, 0, 0.55, 2.7, 4.8, 1.2 * factor, Math.PI / 2)
	]),
	asset('ridge-lantern', [3, 3], (factor) => [
		plate(circle(1.4, 8), 0, 0.2),
		plate(circle(1.13, 8), 0.2, 1.5 * factor, pane),
		cap([0, 0, 0.2 + 1.5 * factor], 1.35, 0.65)
	]),
	asset('cowl-vent', [2, 2], (factor) => [
		drum([0, 0, 0], 0.55, 1.5 * factor),
		cap([0, 0, 1.5 * factor], 0.94, 0.6),
		...row(3, (_, i) => drum([0, 0, 1.5 * factor - 0.2 * i], 0.63, 0.06, pane))
	])
];
