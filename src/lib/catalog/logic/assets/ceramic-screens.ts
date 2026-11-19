import { family, block, row, pipe } from './assembly';
import { drum, ring, water, energy, workshop, living, pane } from './parts';
import { glaze, honeycombCell } from './pottery';
const asset = family('ceramics', 'facade');
export const ceramicScreens = [
	asset('honeycomb-wall', [0.5, 5], (factor) => [
		...Array.from({ length: 3 }, (_, i) =>
			row(4, (_, j) =>
				honeycombCell(
					(j - 1.5 + ((i % 2) - 0.5) * 0.5) * Math.sqrt(3) * 0.59,
					0.59 + i * 0.885,
					0.59,
					0.46 * factor,
					0.36,
					energy
				)
			)
		).flat()
	]),
	asset('fluted-tile', [0.4, 2], (factor, variant) => [
		glaze(block(0.075, 0, 0, 0.15, 1.9, 1.9, living)),
		...row(6 + variant, (t) => glaze(drum([0.16, t * 0.8, 0.1], 0.11 * factor, 1.7, workshop)))
	]),
	asset('button-tile', [0.5, 2], (factor) => [
		glaze(block(0.09, 0, 0, 0.18, 1.9, 1.9)),
		...row(3, (t) => glaze(ring([0.23, t * 0.57, 0.96], 0.28 * factor, 0, 0.24, water)))
	]),
	asset('wave-relief', [0.5, 2.6], (factor) => [
		glaze(block(0.075, 0, 0, 0.15, 2.5, 1.5, pane)),
		...row(4, (_, i) =>
			glaze(
				pipe(
					Array.from({ length: 21 }, (_, j) => [
						0.22,
						(j - 10) * 0.11,
						0.27 + i * 0.31 + Math.sin(j * 0.41) * 0.12 * factor
					]),
					0.075,
					water
				)
			)
		)
	]),
	asset('slotted-screen', [0.5, 4], (factor, variant) => [
		...row(6 + variant, (t) => glaze(block(0.21, t * 1.83, 0, 0.42, 0.18 * factor, 2.6, living))),
		...row(2, (_, i) => glaze(block(0.21, 0, i * 2.45, 0.42, 3.92, 0.15, workshop)))
	])
];
