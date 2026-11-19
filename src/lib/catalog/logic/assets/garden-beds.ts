import { family, block, legs, row, plate, circle, crescent, cage, shell } from './assembly';
import { drum, bulb, rod, ring, energy, food, path, living, pane } from './parts';
const asset = family('gardens', 'deck');
export const gardenBeds = [
	asset('tree-grate', [3, 3], (factor, variant) => [
		plate(circle(1.42), 0, 0.09, path, circle(0.51 * factor).reverse()),
		...circle(1.33, 8 + 8 * variant).map(([x, y]) =>
			rod([x * 0.47, y * 0.47, 0.095], [x, y, 0.095], 0.017)
		)
	]),
	asset('grove-island', [6, 4], (factor) => [
		plate(
			[
				[-2.8, -0.7],
				[-1.8, -1.7],
				[0.2, -0.9],
				[1.8, -1.4],
				[2.8, -0.5],
				[2.5, 1],
				[1, 1.5],
				[-0.7, 0.9],
				[-2.2, 1.5]
			],
			0,
			0.32,
			food
		),
		...row(3, (t, i) => drum([t * 1.88, ((i % 2) - 0.5) * 0.68, 0.32], 0.12, 1.8 * factor)),
		...row(3, (t, i) =>
			bulb([t * 1.88, ((i % 2) - 0.5) * 0.68, 0.32 + 1.95 * factor], 0.8, 0.87, food)
		)
	]),
	asset('grass-trough', [4, 1.5], (factor) => [
		block(0, 0, 0, 3.8, 1.2, 0.54, living),
		...row(15, (t, i) =>
			rod(
				[t * 1.71, ((i % 3) - 1) * 0.26, 0.54],
				[t * 1.81, ((i % 3) - 1) * 0.37, 0.54 + (0.44 + (i % 4) * 0.12) * factor],
				0.035,
				food
			)
		)
	]),
	asset('vine-arch', [4, 4], (factor) => [
		...row(3, (t) => shell('vault', 0, t * 1.65, 0, 3.5, 0.15, 2.8 * factor, 0.16)),
		...row(5, (t) =>
			rod(
				[t * 1.5, -1.65, 2.8 * factor * Math.sqrt(1 - ((t * 1.5) / 1.75) ** 2)],
				[t * 1.5, 1.65, 2.8 * factor * Math.sqrt(1 - ((t * 1.5) / 1.75) ** 2)],
				0.07,
				food
			)
		)
	]),
	asset('crescent-bed', [5, 5], (factor) => [
		crescent(2.35, 1.53, 0, 0.65 * factor, Math.PI * 1.17),
		crescent(2.25, 1.63, 0.65 * factor, 0.09, Math.PI * 1.17, food)
	]),
	asset('stepping-stones', [5, 2], (factor, variant) => [
		...row(5 + variant, (t, i) =>
			drum([t * 2.05, ((i % 2) - 0.5) * 0.63, 0], 0.37 * factor, 0.13, path)
		)
	]),
	asset('fan-trellis', [3, 1], (factor) => [
		...row(7, (t) => rod([t * 0.13, 0, 0.08], [t * 1.37, 0, (2.5 - 0.4 * t * t) * factor], 0.045)),
		...row(3, (_, i) =>
			rod(
				[-(i + 1) * 0.38, 0, (i + 1) * 0.6 * factor],
				[(i + 1) * 0.38, 0, (i + 1) * 0.6 * factor],
				0.04,
				food
			)
		)
	]),
	asset('grow-rack', [4, 2], (factor) => [
		cage(0, 0, 0, 3.5, 1.5, 2.6 * factor, [1, 1, 3], false),
		...row(3, (_, i) => block(0, 0, 0.14 + i * 0.86 * factor, 3.52, 1.5, 0.18)),
		...row(3, (_, i) => block(0, 0, 0.32 + i * 0.86 * factor, 3.32, 1.32, 0.16, food))
	]),
	asset('glasshouse', [5, 6], (factor) => [
		cage(0, 0, 0, 4.5, 5.5, 1.9 * factor, [3, 4, 1], false),
		shell('vault', 0, 0, 1.9 * factor, 4.65, 5.65, 1.5, 0.09, pane),
		...row(2, (t) => ({ ...block(t * 2.25, 0, 0, 0.08, 5.5, 1.9 * factor, pane), glass: true }))
	]),
	asset('bee-stack', [2, 2], (factor, variant) => [
		...row(4 + variant, (_, i) => block(0, 0, i * 0.37, 1.35, 1.04, 0.34, energy)),
		block(0, 0, (4 + variant) * 0.37, 1.56, 1.2, 0.14),
		block(0, -0.65, 0.21, 1.15 * factor, 0.38, 0.09)
	]),
	asset('nest-wall', [4, 1.2], (factor, variant) => [
		...Array.from({ length: 2 + variant }, (_, i) =>
			row(4, (t, j) =>
				block(
					0.91 * t * 1.4 + ((i % 2) - 0.5) * 0.32,
					0,
					i * 0.63,
					0.82,
					0.8,
					0.61,
					i % 2 === j % 2 ? living : energy
				)
			)
		).flat(),
		...Array.from({ length: 2 + variant }, (_, i) =>
			row(4, (t) => ({
				...ring(
					[0.91 * t * 1.4 + ((i % 2) - 0.5) * 0.32, -0.41, i * 0.63 + 0.36],
					0.11 * factor,
					0,
					0.035,
					path
				),
				rotation: Math.PI / 2
			}))
		).flat()
	]),
	asset('compost-bin', [2, 2], (factor) => [
		...legs(0.81, 0.81, 1.25 * factor, 0.08),
		...Array.from({ length: 5 }, (_, i) =>
			row(2, (t) => block(0, t * 0.79, i * 0.25 * factor, 1.73, 0.11, 0.19 * factor, food))
		).flat(),
		...Array.from({ length: 5 }, (_, i) =>
			row(2, (t) => block(t * 0.79, 0, i * 0.25 * factor, 0.11, 1.5, 0.19 * factor, food))
		).flat()
	])
];
