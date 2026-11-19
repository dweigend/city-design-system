import { family, block, row, plate, circle, shell, slope } from './assembly';
import { drum, white, energy, food, living, pane } from './parts';
const asset = family('house-bodies', 'deck');
export const houseVolumes = [
	asset('plug-box', [5, 4], (factor) => [
		block(0, 0, 0, 4.8 * factor, 3.6, 2.8, living),
		block(0, -1.81, 1.1, 3.8 * factor, 0.08, 1, pane)
	]),
	asset('court-block', [8, 8], (factor) => [
		plate(
			[
				[-4, -4],
				[4, -4],
				[4, 4],
				[-4, 4]
			],
			0,
			3 * factor,
			living,
			[
				[-2, -2],
				[-2, 2],
				[2, 2],
				[2, -2]
			]
		)
	]),
	asset('ridge-house', [6, 5], (factor) => [
		block(0, 0, 0, 6, 4.8, 3 * factor, living),
		slope(-1.5, 0, 3 * factor, 3, 4.8, 2 * factor, Math.PI),
		slope(1.5, 0, 3 * factor, 3, 4.8, 2 * factor)
	]),
	asset('drum-house', [6, 6], (factor) => [
		drum([0, 0, 0], 2.9, 2.2 * factor, living),
		drum([0, 0, 2.2 * factor], 2.86, 0.65, pane),
		drum([0, 0, 2.2 * factor + 0.65], 3, 0.18)
	]),
	asset('terraced-body', [8, 6], (factor, variant) => [
		...row(3 + variant, (_, i) =>
			block(-i * 0.45, 0, i * 2, 8 - i * 0.95, 5.8, 2, i % 2 ? white : living)
		),
		block(-1.1, 0, (3 + variant) * 2, 2 * factor, 3, 0.15, food)
	]),
	asset('offset-stack', [7, 5], (factor, variant) => [
		...row(3 + variant, (_, i) =>
			block(((i % 2) - 0.5) * 1.4, 0, i * 2.5, 5.5 * factor, 4.8, 2.5, i % 2 ? living : white)
		)
	]),
	asset('gallery-bar', [10, 4], (factor, variant) => [
		block(0, 0.5, 0, 9.6 * factor, 2.8, 3, living),
		block(0, -1.4, 0, 10 * factor, 1, 0.22),
		...row(4 + variant, (t) => drum([t * 4.7 * factor, -1.8, 0.22], 0.07, 2.8)),
		block(0, -1.4, 3, 10 * factor, 1, 0.14)
	]),
	asset('tube-house', [4, 7], (factor) => [
		shell('vault', 0, 0, 0, 3.6, 6.6 * factor, 3, 0.22, living),
		block(0, 0, 0, 3.6, 6.6 * factor, 0.18)
	]),
	asset('setback-storey', [7, 5], (factor) => [
		block(0, 0, 0, 6.8 * factor, 4.8, 0.26),
		block(-0.45 * factor, 0.45, 0.26, 5.5 * factor, 3.7, 2.8, living),
		block(-0.45 * factor, -1.42, 1.1, 4.7 * factor, 0.08, 0.95, pane)
	]),
	asset('lantern-head', [6, 6], (factor, variant) => [
		drum([0, 0, 0], 1.25, 0.7),
		plate(circle(2.8, 6 + variant), 0.7, 0.32),
		plate(circle(2.58, 6 + variant), 1.02, 2.4 * factor, pane),
		plate(circle(2.9, 6 + variant), 1.02 + 2.4 * factor, 0.25, energy)
	]),
	asset('disc-tower', [6, 6], (factor, variant) => [
		drum([0, 0, 0], 1, 2 * (3 + variant)),
		...row(3 + variant, (_, i) => drum([0, 0, i * 2 + 0.15], 2.8 * factor, 0.32))
	]),
	asset('service-core', [3, 4], (factor, variant) => [
		block(0, 0, 0, 2.8, 3.8, 9 * factor),
		...row(3 + variant, (t) => block(0, -1.92, (t + 1) * 3.6 * factor + 0.4, 1.1, 0.08, 0.5, pane))
	]),
	asset('twin-core', [5, 3], (factor) => [
		block(-1.55, 0, 0, 1.4, 2.8, 10 * factor),
		block(1.55, 0, 0, 1.4, 2.8, 9 * factor),
		...row(3, (_, i) => block(0, 0, 1 + i * 3 * factor, 3.2, 1, 0.4))
	]),
	asset('stepped-gable-body', [6, 5], (factor, variant) => [
		block(0, 0, 0, 6, 4.8, 3),
		...row(2 + variant, (_, i) =>
			block(0, -2.22, 3 + i * 0.52 * factor, 5.4 - i * 1.25, 0.35, 0.52 * factor + 0.15, living)
		)
	]),
	asset('corner-house', [7, 7], (factor) => [
		plate(
			[
				[-3, -3],
				[3, -3],
				[3, -0.5],
				[-0.5, -0.5],
				[-0.5, 3],
				[-3, 3]
			],
			0,
			3.6 * factor,
			living
		)
	])
];
