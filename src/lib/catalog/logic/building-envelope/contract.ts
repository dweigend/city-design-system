import { defineParams, numberParam, resolveParams, type ParamOverrides } from '../params';
import type { Point2 } from '../parametrik/vocab';

export const envelopeParams = defineParams({
	height: numberParam('Storey height', 'm', 3, [0.01, 100, 0.1]),
	offset: numberParam('Storey offset from cell', 'm', 0, [-100, 100, 0.1]),
	radius: numberParam('Corner radius', 'm', 0, [0, 100, 0.1]),
	direction: numberParam('Ridge azimuth', 'rad', 0, [-2 * Math.PI, 2 * Math.PI, 0.05]),
	pitch: numberParam('Roof pitch', 'rad', 0.55, [0, 1.48, 0.01]),
	teeth: numberParam('Saw teeth', '', 3, [1, 32, 1], 'integer')
});
export type Roof = 'hip' | 'gable' | 'sawtooth' | 'shed';
export type BuildingCell = {
	polygon: readonly Point2[];
	roof: Roof;
	params?: Pick<ParamOverrides<typeof envelopeParams>, 'direction' | 'pitch' | 'teeth'>;
	storeys?: readonly Pick<ParamOverrides<typeof envelopeParams>, 'height' | 'offset' | 'radius'>[];
	/** Elevation at the highest foundation corner. Ground falls away with the given x/y gradient. */
	base?: number;
	grade?: Point2;
};
/** Local metre coordinates relative to the double-precision world origin. Each exclusive
 * index end completes one closed manifold shell. Shells have disjoint vertex indices,
 * including when corners or edges coincide geometrically. Never weld across these ranges.
 */
export type EnvelopeMesh = {
	origin: [number, number, number];
	positions: Float32Array;
	indices: Uint32Array;
	shellIndexEnds: number[];
};
export type Settings = ReturnType<typeof settings>;
/** Resolves a cell roof and one storey against the shared schema. */
export function settings(cell: BuildingCell, floor: NonNullable<BuildingCell['storeys']>[number]) {
	return resolveParams(envelopeParams, cell.params, floor);
}
