import { buildSurface, createClad, createSamplePlateObject } from './index';

/** Masonry on a 2 x 2 m wall facing south with one window, lit with a world-space light. */
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
		{ light: [0.36, 0.48, -1], seed: 1 }
	);
}

/** An L-shaped timber and render wall run with a window opening, footing and corner anchor. */
export function cladExample() {
	return createClad(
		{
			id: 'wall-run',
			footprint: { width: 3, depth: 2 },
			anchors: [{ name: 'corner', position: [3, 0, 0], normal: [1, 0, 0] }],
			slots: ['foot'],
			parts: [
				{
					id: 'footing',
					slot: 'foot',
					shape: { kind: 'box', center: [1.5, 0, -0.1], size: [3, 0.3, 0.2], rotation: 0 }
				}
			]
		},
		[
			{
				role: 'wall',
				family: 'timber',
				patch: {
					origin: [0, 0, 0],
					across: [1, 0, 0],
					normal: [0, -1, 0],
					size: [3, 2],
					thickness: 0.12,
					openings: [[1, 0.5, 2, 1.5]]
				}
			},
			{
				role: 'wall',
				family: 'render',
				patch: {
					origin: [3, 0, 0],
					across: [0, 1, 0],
					normal: [1, 0, 0],
					size: [2, 2],
					thickness: 0.12
				}
			}
		],
		{ light: [0.36, 0.48, -1] }
	);
}

/** A horizontal timber plate with a face anchor at the patch origin. */
export function plateExample() {
	return createSamplePlateObject(
		'timber-sample',
		{
			origin: [0, 0, 0.12],
			across: [1, 0, 0],
			normal: [0, 0, 1],
			size: [2, 1],
			thickness: 0.12
		},
		'timber',
		{ seed: 3 }
	);
}
