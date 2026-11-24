import { buildSurface, readLight } from './index';

/** Masonry on a 2 x 2 m wall facing south with one window, lit as the stage lights it. */
export function example() {
	return buildSurface(
		'masonry',
		{
			origin: [0, 0, 0],
			across: [1, 0, 0],
			normal: [0, -1, 0],
			size: [2, 2],
			thickness: 0.12,
			openings: [[0.6, 0.8, 1.4, 1.6]]
		},
		{ light: readLight([0.6, 0.8], 0.6), seed: 1 }
	);
}
