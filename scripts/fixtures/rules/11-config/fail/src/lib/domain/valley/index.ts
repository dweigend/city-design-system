export const setbackM = 3;
export const policy = { storeysPerLevel: 2 };
export function repeat(count = 4) {
	return count;
}
export const repeated = repeat(5);
export { inputs } from '../../../config/inputs';

// Exact arithmetic: one edge has two endpoints.
export function tubeRadius(edge: readonly number[]) {
	const endpointCount = /* Exact arithmetic: endpoints of a segment. */ 2;
	return (edge.length / endpointCount) * (1 - 1 / 8);
}

export const offset = (x: number) => x * 0.37;
export const tube = /* Exact arithmetic: the ring begins at the origin. */ {
	origin: /* Exact arithmetic: local origin. */ 0,
	radiusRatio: 0.37
};
