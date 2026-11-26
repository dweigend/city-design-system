import { createMeshObject, createSweptTube, mesh } from './index';

/** Builds a four-meter ribbon with a one-meter plan width. */
export function example() {
	const deck = mesh();
	deck.ribbon(
		[
			[0, 0, 1],
			[4, 0, 1]
		],
		1,
		0.25
	);
	return createMeshObject('ribbon', { deck }, []);
}

/** Sweeps a circular shell from a horizontal run into a rising span with open end collars. */
export function sweptTubeExample() {
	return createSweptTube(
		[
			[0, 0, 0],
			[3, 0, 0],
			[6, 0, 3]
		],
		{
			radius: 0.2,
			radialSegments: 12,
			startTransverse: [0, 1, 0],
			collars: { innerRadius: 0.19, outerRadius: 0.24, width: 0.1 }
		}
	);
}
