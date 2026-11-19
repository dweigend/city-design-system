import { alphaSteps, diffusionSteps, materialSpec, materials } from '../../data/material';
import { materialAusfuehrungen, type AusfuehrungId } from '../../data/materialAusfuehrung';
import { familien } from '../../data/materialSeite';
import { printPatterns, type PrintPattern } from '../../data/materialPrint';
import { materialLook, type MaterialLook } from '../parametrik/material';
import type { ColorToken, FinishId, Primitive } from '../parametrik/types';
import { ausfuehrungenVon } from './ausfuehrung';
import { rezept, voreinstellung, type Rezept } from './rezept';
import type { MaterialVariation } from './variation';

export type SurfaceRecipe =
	| { kind: 'physical'; id: AusfuehrungId; recipe: Rezept; variation?: MaterialVariation }
	| { kind: 'diagram'; id?: FinishId; recipe: Rezept; pattern?: MaterialLook['pattern'] }
	| { kind: 'kiln'; id: 'fired-slip'; token: ColorToken }
	| { kind: 'print'; id: 'glaze' | 'print-terrazzo' | 'halftone'; token: ColorToken }
	| { kind: 'pattern'; id: PrintPattern; token: ColorToken; translucent?: boolean };

export const finishCatalogue: readonly { id: FinishId; name: string }[] = [
	...materials.map(({ id, name }) => ({ id, name: id === 'glaze' ? 'Dipped glaze print' : name })),
	...materialAusfuehrungen.map(({ id, name }) => ({ id, name })),
	{ id: 'fired-slip', name: 'Fired slip' },
	{ id: 'print-terrazzo', name: 'Terrazzo print' },
	{ id: 'halftone', name: 'Halftone shadow' },
	...Object.keys(printPatterns).map((id) => ({
		id: id as PrintPattern,
		name: id.replace('print-', 'Printed ')
	}))
];

/** Resolves an explicit pigment and finish without consulting geometry, role or theme. */
export function resolveFinish(id: FinishId, token: ColorToken, ageTint = 0): SurfaceRecipe {
	const surface = baseFinish(id, token);
	if (ageTint && (surface.kind === 'diagram' || surface.kind === 'physical')) {
		const color = surface.recipe.farbe;
		color.papier += (1 - color.papier) * ageTint;
	}
	return surface;
}

function baseFinish(id: FinishId, token: ColorToken): SurfaceRecipe {
	if (id === 'fired-slip') return { kind: 'kiln', id, token };
	if (id === 'glaze' || id === 'print-terrazzo' || id === 'halftone')
		return { kind: 'print', id, token };
	if (Object.hasOwn(printPatterns, id)) return { kind: 'pattern', id: id as PrintPattern, token };
	const physical = materialAusfuehrungen.find((f) => f.id === id);
	if (physical) {
		const recipe = rezept(physical.familie, voreinstellung(physical.familie, 'neutral'));
		recipe.farbe.token = token;
		return { kind: 'physical', id: physical.id, recipe };
	}
	const spec = materials.find((f) => f.id === id);
	if (!spec) throw new RangeError('Unknown finish: ' + id);
	return drawingSurface(materialLook(spec.id, token));
}

/** Preserves the authored family default and control offsets of an instructional recipe. */
export function physicalRecipe(
	recipe: Rezept,
	id?: AusfuehrungId,
	variation?: MaterialVariation
): SurfaceRecipe {
	const choices = ausfuehrungenVon(recipe.familie);
	const finish = choices.find((f) => f.id === id) ?? choices[0];
	return { kind: 'physical', id: finish.id, recipe, variation };
}

/** Translates the compact drawing vocabulary to the same six-node recipe as the bible diagram. */
export function drawingSurface(look: MaterialLook): SurfaceRecipe {
	const spec = materialSpec(look.material);
	const family = familien.find((f) => f.material === look.material)?.id ?? 'bestand';
	const r = rezept(family);
	const recipe: Rezept = {
		...r,
		farbe: { token: look.token, papier: look.paper, tint: look.tint },
		ton: { kontrast: look.contrast },
		rauschen: null,
		fugen: null,
		kante: null,
		haut: {
			sheen: look.sheen,
			glanz: look.gloss,
			glanzbreite: 0.022,
			truebung: look.milk,
			deckkraft: alphaSteps[spec.alpha],
			diffusion: diffusionSteps[spec.diffusion].share,
			unschaerfe: look.blur,
			bewegt: false
		}
	};
	return { kind: 'diagram', id: look.material, recipe, pattern: look.pattern };
}

/** Dresses a triangle-bearing part after generation; drawing strokes retain their original treatment. */
export function applySurface(part: Primitive, finish?: FinishId, token?: ColorToken): Primitive {
	if (part.kind === 'polyline' || (finish === undefined && token === undefined)) return part;
	return { ...part, ...(finish === undefined ? {} : { finish }), token: token ?? part.token };
}
