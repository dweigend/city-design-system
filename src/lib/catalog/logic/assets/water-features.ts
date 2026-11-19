import { family, block, row, crescent, pipe } from './assembly';
import { drum, bulb, rod, cap, water, food, path, pane } from './parts';
import { vessel } from './pottery';
const asset = family('waterworks', 'deck');
export const waterFeatures = [
	asset('detention-basin', [6, 6], (factor) => [
		vessel(
			[
				[2.15, 0],
				[2.8, 0.65],
				[2.86, 0.72]
			],
			32,
			factor,
			pane
		),
		drum([0, 0, 0.15 * factor], 2.22, 0.055, water)
	]),
	asset('cistern', [3, 3], (factor) => [
		drum([0, 0, 0], 1.35, 2.1 * factor, water),
		cap([0, 0, 2.1 * factor], 1.35, 0.23),
		drum([0, 0, 2.1 * factor + 0.22], 0.29, 0.1)
	]),
	asset('filter-bed', [5, 3], (factor) => [
		block(0, 0, 0, 4.8, 2.8, 0.32),
		block(0, 0, 0.32, 4.56, 2.56, 0.06, food),
		...row(15, (t, i) =>
			rod(
				[t * 2.1, ((i % 3) - 1) * 0.79, 0.38],
				[t * 2.18, ((i % 3) - 1) * 0.89, (0.91 + (i % 4) * 0.12) * factor],
				0.045,
				food
			)
		)
	]),
	asset('open-rill', [5, 1.4], (factor) => [
		block(0, 0, 0, 4.9, 1.25, 0.13, water),
		...row(2, (t) => block(0, t * 0.57, 0.13, 4.9, 0.12, 0.25 * factor))
	]),
	asset('pond-island', [5, 5], (factor) => [
		drum([0, 0, 0], 2.32, 0.16, water),
		crescent(2.42, 2.24, 0, 0.28, Math.PI * 1.98),
		block(0, 0, 0.29, 4.8, 0.61, 0.13, path),
		...row(2, (t) => bulb([t * 0.9, t * 1.25, 0.22], 0.42 * factor, 0.42, food))
	]),
	asset('drinking-loop', [2, 2], (factor) => [
		drum([0, 0, 0], 0.23, 1.05 * factor),
		crescent(0.8, 0.62, 1.05 * factor, 0.14, Math.PI * 1.85, water),
		block(0.34, 0, 1.05 * factor, 0.68, 0.21, 0.13),
		pipe(
			[
				[0.69, 0, 1.14 * factor],
				[0.69, 0, 1.36 * factor],
				[0.53, 0, 1.36 * factor]
			],
			0.052
		)
	]),
	asset('spray-fan', [3, 3], (factor) => [
		crescent(1.29, 0.17, 0, 0.12, Math.PI, pane),
		...row(7, (t) =>
			rod(
				[t * 0.1, 0.04, 0.13],
				[t * 1.14, 0.95, (0.62 + 0.42 * (1 - t * t)) * factor],
				0.035,
				water
			)
		)
	]),
	asset('pump-rill', [3, 1.4], (factor) => [
		block(0, 0, 0, 2.8, 1.2, 0.15, water),
		drum([-0.98, 0, 0.15], 0.17, 1.12 * factor),
		pipe(
			[
				[-0.98, 0, 1.12 * factor],
				[-0.98, 0, 1.39 * factor],
				[-0.48, 0, 1.39 * factor],
				[-0.48, 0, 1.22 * factor]
			],
			0.065
		),
		rod([-1.35, 0, 1.5 * factor], [-0.82, 0, 1.29 * factor], 0.045)
	]),
	asset('rain-funnel', [3, 3], (factor) => [
		vessel(
			[
				[0.31, 0],
				[0.23, 1.25],
				[0.42, 1.72],
				[1.38, 2.06],
				[1.43, 2.2]
			],
			32,
			factor,
			water
		)
	]),
	asset('mist-arm', [2, 1], (factor) => [
		pipe(
			[
				[-0.68, 0, 0.08],
				[-0.68, 0, 2.55 * factor],
				[-0.4, 0, 2.83 * factor],
				[0.78, 0, 2.83 * factor]
			],
			0.085
		),
		...row(4, (t) => drum([0.18 + t * 0.48, 0, 2.83 * factor - 0.16], 0.06, 0.12, water))
	])
];
