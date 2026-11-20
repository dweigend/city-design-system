import { buildingPalette } from '../logic/material/building-palette';
import { finishMaterial } from '../logic/material/surface';
import type { Primitive } from '../logic/parametrik/types';

/** Dresses a tagged building role for both stages, leaving explicit finishes and drawing stock intact. */
export function projectBuildingSurface(part: Primitive): Primitive {
	const context = part.buildingSurface;
	if (
		!context ||
		part.finish ||
		part.role === 'bestand' ||
		part.planned ||
		part.material === 'ghost'
	)
		return part;
	const surface = buildingPalette(context.use, context.ensemble)[context.slot];
	return {
		...part,
		...surface,
		token: context.pigment ?? surface.token,
		material: finishMaterial(surface.finish)
	};
}
