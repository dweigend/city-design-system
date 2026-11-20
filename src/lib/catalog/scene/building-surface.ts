import { resolveBuildingSurface } from '../logic/material/building-palette';
import { finishMaterial } from '../logic/material/surface';
import type { ColorToken, Primitive } from '../logic/parametrik/types';

type Projected = Primitive & { token: ColorToken };

function hasToken(part: Primitive): part is Projected {
	return part.token !== undefined;
}

/** Resolves a building slot at projection time and preserves caller-selected drawing treatments. */
export function projectBuildingSurface(part: Primitive): Projected {
	const context = part.buildingSurface;
	if (
		!context ||
		part.finish ||
		part.role === 'bestand' ||
		part.planned ||
		part.material === 'ghost'
	) {
		if (hasToken(part)) return part;
		const token = context ? resolveBuildingSurface(context).token : '--paper';
		return { ...part, token };
	}
	const surface = resolveBuildingSurface(context);
	return {
		...part,
		...surface,
		token: context.pigment ?? surface.token,
		material: finishMaterial(surface.finish)
	};
}
