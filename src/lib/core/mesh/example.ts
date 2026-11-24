import { createMeshObject, mesh } from './index';

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
