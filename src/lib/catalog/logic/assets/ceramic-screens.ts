import { waveWall } from './wave-wall';
import { family, block, row } from './assembly';
import { buttonTile, flutedTile } from './ceramic-tiles';
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
	asset('fluted-tile', ['accent', 'trim'], [0.4, 2], flutedTile),
	asset('button-tile', ['body', 'channel'], [0.5, 2], buttonTile),
	asset('wave-relief', ['glass', 'channel'], [0.5, 2.6], waveWall),
	asset('slotted-screen', ['accent', 'trim'], [0.5, 4], (factor, variant) => [
		...row(3 + 2 * variant, (t) => block(0.21, t * 1.83, 0, 0.42, 0.18 * factor, 2.6, 'accent')),
		...row(2, (_, i) => block(0.21, 0, i * 2.45, 0.42, 3.92, 0.15, 'trim'))
	])
];
