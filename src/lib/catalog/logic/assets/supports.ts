import { family, block, legs, row, plate, cage, shell, pipe } from './assembly';
import { bulb, rod, water, workshop } from './parts';
const asset = family('structure', 'deck');
export const supports = [
	asset('portal-bay', [6, 4], (factor) => [
		...legs(2.75, 1.7, 3.4 * factor, 0.16),
		...row(2, (t) => block(0, t * 1.7, 3.4 * factor, 5.9, 0.38, 0.42)),
		...row(2, (t) => block(t * 2.75, 0, 3.4 * factor, 0.38, 3.4, 0.42))
	]),
	asset('arcade-run', [9, 2], (factor) => [
		...row(3, (_, i) => shell('arch', (i - 1) * 2.9, 0, 0, 2.9, 1.4, 2.8 * factor, 0.28))
	]),
	asset('pilotis-pair', [5, 2], (factor) => [
		...row(2, (t) => rod([t * 1.2, 0, 0.12], [t * 2.1, 0, 4 * factor], 0.18)),
		block(0, 0, 4 * factor - 0.12, 4.7, 1.1, 0.33)
	]),
	asset('space-truss', [8, 2], (factor, variant) => [
		{
			...cage(0, 0, 0, 7.7, 1.7, 1.3 * factor, [2 + 2 * variant, 1, 1]),
			bar: 0.16,
			finish: 'metal',
			token: '--blueprint'
		}
	]),
	asset('lattice-mast', [3, 3], (factor, variant) => [
		{
			...cage(0, 0, 0, 2.6, 2.6, 9 * factor, [1, 1, 2 + 2 * variant]),
			bar: 0.16,
			finish: 'metal',
			token: '--blueprint'
		},
		block(0, 0, 9 * factor + 0.08, 2.9, 2.9, 0.16)
	]),
	asset('gusset-joint', [2, 2], (factor) => [
		block(0, 0, 0, 1.8, 0.18, 1.2 * factor, workshop),
		...row(3, (t) => rod([t * 0.66, -0.14, 0.45 * factor], [t * 0.66, 0.14, 0.45 * factor], 0.09))
	]),
	asset('cross-brace', [5, 1], (factor) => [
		rod([-2.3, 0, 0.12], [2.3, 0, 3.5 * factor], 0.095, workshop),
		rod([2.3, 0.2, 0.12], [-2.3, 0.2, 3.5 * factor], 0.095, workshop)
	]),
	asset('plate-girder', [8, 1], (factor) => [
		block(0, 0, 0, 7.8, 0.8, 0.12),
		block(0, 0, 0.12, 7.8, 0.13, 1.1 * factor),
		block(0, 0, 0.12 + 1.1 * factor, 7.8, 0.8, 0.12)
	]),
	asset('kingpost-truss', [7, 1], (factor) => [
		rod([-3.2, 0, 0.12], [3.2, 0, 0.12], 0.1),
		pipe(
			[
				[-3.2, 0, 0.12],
				[0, 0, 2.5 * factor],
				[3.2, 0, 0.12]
			],
			0.11
		),
		rod([0, 0, 0.12], [0, 0, 2.5 * factor], 0.09)
	]),
	asset('derrick', [6, 4], (factor) => [
		{
			...cage(-1.1, 0, 0, 1.5, 1.5, 5 * factor, [1, 1, 3]),
			bar: 0.16,
			finish: 'metal',
			token: '--blueprint'
		},
		rod([-1.1, 0, 5 * factor], [2.7, 0, 6 * factor], 0.14),
		rod([-1.1, 0, 3.4 * factor], [2.7, 0, 6 * factor], 0.11),
		rod([2.7, 0, 6 * factor], [2.7, 0, 3 * factor], 0.04)
	]),
	asset('pipe-rack', [6, 3], (factor, variant) => [
		...legs(2.7, 1.2, 2.2),
		...row(2, (t) => block(t * 2.7, 0, 2.2, 0.23, 2.7, 0.22)),
		...row(3 + variant, (t) =>
			rod([-2.9, t * 0.95, 2.63], [2.9, t * 0.95, 2.63], 0.16 * factor, water)
		)
	]),
	asset('pipe-tee', [3, 3], (factor) => [
		pipe(
			[
				[-1.4, 0, 0.34],
				[1.4, 0, 0.34]
			],
			0.27 * factor,
			water
		),
		rod([0, 0, 0.34], [0, 1.4, 0.34], 0.27 * factor, water),
		bulb([0, 0, 0.34], 0.32 * factor, 1, water)
	]),
	asset('pipe-elbow', [3, 3], (factor) => [
		pipe(
			[
				[-1.35, -0.7, 0.3],
				[0.2, -0.7, 0.3],
				[0.55, -0.56, 0.3],
				[0.72, -0.23, 0.3],
				[0.72, 1.35, 0.3]
			],
			0.25 * factor,
			water
		)
	]),
	asset('storage-rack', [5, 3], (factor) => [
		cage(0, 0, 0, 4.6, 2.6, 3.5 * factor, [2, 1, 3], false),
		...row(4, (_, i) => block(0, 0, 0.08 + (i * 3.5 * factor) / 3, 4.6, 2.6, 0.09))
	])
];
