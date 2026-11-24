import { createPlanarTopology, readFaceUnionBoundary, readPlanarSubset } from './index';

export function example() {
	const faces = [
		{ id: 'west', vertexIds: ['a', 'b', 'e', 'd'] },
		{ id: 'east', vertexIds: ['b', 'c', 'f', 'e'] }
	];
	const plan = createPlanarTopology(faces);
	const west = readPlanarSubset(plan.faces, ['west']);
	return { plan, westBoundary: west.boundary, union: readFaceUnionBoundary(faces) };
}
