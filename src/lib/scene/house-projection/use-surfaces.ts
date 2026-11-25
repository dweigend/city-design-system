import { defaults } from '../../../config/house-projection';
import type { HousePartAddress } from '../../domain/house-court';
import type { StoreyProgram } from '../../domain/massing';
import { readDisplayPresentation } from '../focus';
import type { Drawable, Surface } from '../surface';
import { houseLevels } from './levels';

export const houseUseColors = Object.freeze({
	public: '--house-public',
	workshop: '--cat-living',
	office: '--cat-mobility',
	housing: '--body-living',
	'city-farm': '--cat-nature',
	greenhouse: '--cat-foliage'
} as const satisfies Record<StoreyProgram['use'], Surface['color']>);

export type ProgramDrawing = Readonly<{
	parts: ReadonlyMap<string, HousePartAddress>;
	stock: 'transparent' | 'pencil';
}>;

export function paintHousePhase(drawable: Drawable, drawing?: ProgramDrawing): Drawable {
	const program = drawing?.parts.get(drawable.id)?.program;
	if (!program || !drawing) return drawable;
	const body = {
		...drawable,
		creaseAngleRad: defaults.plainCreaseRad,
		useColor: houseUseColors[program.use]
	};
	if (program.phase === 'retained') {
		const { stock } = drawing;
		const { treatment } = readDisplayPresentation(stock);
		return {
			...body,
			...houseLevels[stock].surfaces.mass,
			grain: undefined,
			flat: undefined,
			...(treatment === 'pencil'
				? { hatch: houseLevels[stock].hatch }
				: { fillAlpha: houseLevels[stock].fillAlpha, occlude: true })
		};
	}
	return program.use === 'greenhouse'
		? { ...body, color: '--model-acrylic', finish: 'glass', grain: undefined }
		: body;
}

/** Applies the house function palette using the existing drawable geometry. */
export function paintHouseUse(drawable: Drawable): Drawable {
	return drawable.useColor
		? {
				...drawable,
				color: drawable.useColor,
				preserveColor: true,
				fillAlpha: /* Exact arithmetic: unity alpha keeps the stage's display treatment. */ 1,
				finish: 'matte',
				hatch: undefined,
				occlude: undefined,
				grain: undefined,
				opacity: undefined
			}
		: drawable;
}
