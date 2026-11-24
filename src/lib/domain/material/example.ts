import { buildSurface, createClad, createSamplePlateObject } from './index';

/** Stripe laminate on a 2 x 2 m wall facing south with one window, at the near level. */
export function example() {
	return buildSurface(
		'stripe',
		{
			origin: [0, 0, 0],
			across: [1, 0, 0],
			normal: [0, -1, 0],
			size: [2, 2],
			thickness: 0.12,
			openings: [[0.6, 0.8, 1.4, 1.6]]
		},
		{ level: 'near' }
	);
}

/** One stripe body of 3 x 2 x 2 m: its south wall with a window and its flat top share one
 * pattern box, so the stripes run over the eaves; a board footing as a plain part. */
export function cladExample() {
	return createClad(
		{
			id: 'stripe-body',
			footprint: { width: 3, depth: 2 },
			anchors: [{ name: 'corner', position: [3, 0, 0], normal: [1, 0, 0] }],
			slots: ['foot'],
			parts: [
				{
					id: 'footing',
					slot: 'foot',
					shape: { kind: 'box', center: [1.5, 1, -0.1], size: [3, 2, 0.2], rotation: 0 }
				}
			]
		},
		[
			{
				role: 'wall',
				family: 'stripe',
				body: 'body',
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
				role: 'roof',
				family: 'stripe',
				body: 'body',
				patch: {
					origin: [0, 0, 2],
					across: [1, 0, 0],
					normal: [0, 0, 1],
					size: [3, 2],
					thickness: 0.12
				}
			}
		]
	);
}

/** A horizontal cork plate with a face anchor at the patch origin. */
export function plateExample() {
	return createSamplePlateObject(
		'cork-sample',
		{
			origin: [0, 0, 0.12],
			across: [1, 0, 0],
			normal: [0, 0, 1],
			size: [2, 1],
			thickness: 0.12
		},
		'cork'
	);
}
