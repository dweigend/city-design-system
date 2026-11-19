import { family, block, row, pipe } from './assembly';
import { drum, ring } from './parts';
import { honeycombCell } from './pottery';
const asset = family('ceramics', 'facade');
export const ceramicScreens = [
	asset('honeycomb-wall', ['highlight'], [0.5, 5], (factor, variant) => [
		...Array.from({ length: 2 + variant }, (_, i) =>
			row(4, (_, j) =>
				honeycombCell(
					(j - 1.5 + ((i % 2) - 0.5) * 0.5) * Math.sqrt(3) * 0.59,
					0.59 + i * 0.885,
					0.59,
					0.46 * factor,
					0.36,
					'highlight'
				)
			)
		).flat()
	]),
	asset('fluted-tile', ['accent', 'trim'], [0.4, 2], (factor, variant) => [
		block(0.075, 0, 0, 0.15, 1.9, 1.9, 'accent'),
		...row(3 + 2 * variant, (t) => drum([0.16, t * 0.8, 0.1], 0.11 * factor, 1.7, 'trim'))
	]),
	asset('button-tile', ['body', 'channel'], [0.5, 2], (factor, variant) => [
		block(0.09, 0, 0, 0.18, 1.9, 1.9),
		...row(2 + variant, (t) => ring([0.23, t * 0.66, 0.96], 0.28 * factor, 0, 0.24, 'channel'))
	]),
	asset('wave-relief', ['glass', 'channel'], [0.5, 2.6], (factor, variant) => [
		block(0.075, 0, 0, 0.15, 2.5, 1.5, 'glass'),
		...row(2 + variant, (_, i) =>
			pipe(
				Array.from({ length: 21 }, (_, j) => [
					j === 0 || j === 20 ? 0.075 : 0.22,
					(j - 10) * 0.11,
					0.27 + i * (0.94 / (1 + variant)) + Math.sin(j * 0.41) * 0.12 * factor
				]),
				0.075,
				'channel'
			)
		)
	]),
	asset('slotted-screen', ['accent', 'trim'], [0.5, 4], (factor, variant) => [
		...row(3 + 2 * variant, (t) => block(0.21, t * 1.83, 0, 0.42, 0.18 * factor, 2.6, 'accent')),
		...row(2, (_, i) => block(0.21, 0, i * 2.45, 0.42, 3.92, 0.15, 'trim'))
	])
];
