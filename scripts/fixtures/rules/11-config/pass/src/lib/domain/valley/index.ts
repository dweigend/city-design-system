import { settings } from '../../../config/hydrology';

export const setbackM = settings.setbackM.value;
export const triangleCount = (indices: readonly number[]) => indices.length / 3;

export function measureSpan(edge: readonly number[]) {
	const endpointCount = /* Exact arithmetic: endpoints of a segment. */ 2;
	return edge.length / endpointCount;
}

export function smoothStep(t: number) {
	return t * t * /* Exact arithmetic: end slopes of the interpolation are zero. */ (3 - 2 * t);
}
