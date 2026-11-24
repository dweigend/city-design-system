import type { PlaceableObject } from '../../core/object';
import { defaults } from '../../../config/house-projection';
import type { DisplayLevel } from '../focus';
import { resolveSurfaces, type Drawable, type SurfaceAssignment } from '../surface';
import { blockSurfaces, fullSurfaces, pencilSurfaces, veilSurfaces } from './surfaces';

const { pencilHatch, veilAlpha, sheetGapM } = defaults;

/** Gap in meters between houses laid side by side on one sheet. */
export const houseSheetGapM = sheetGapM;

/** The drawing of a house at each display level of COLOR-6: which object detail it reads and how
 * the slots look. `hidden` draws nothing. */
// Exact arithmetic: structural counts, origins and unit axes, not tunables.
export const houseLevels = Object.freeze({
	full: { detail: 'full', surfaces: fullSurfaces, hatch: 0, fillAlpha: 1 },
	silhouette: { detail: 'block', surfaces: blockSurfaces, hatch: 0, fillAlpha: 1 },
	transparent: { detail: 'block', surfaces: veilSurfaces, hatch: 0, fillAlpha: veilAlpha },
	pencil: { detail: 'block', surfaces: pencilSurfaces, hatch: pencilHatch, fillAlpha: 1 },
	hidden: { detail: 'block', surfaces: undefined, hatch: 0, fillAlpha: 0 }
} as const satisfies Record<DisplayLevel, unknown>);

/** Object detail the level needs: `full` or `block`. */
export function houseDetailOf(level: DisplayLevel) {
	return houseLevels[level].detail;
}

/** Colours a house object for one display level through the single surface boundary, reading
 * each declared slot from the level's role table. A slot the table lacks throws RangeError. Any
 * object with these role slots can be drawn, not only the court house. */
export function projectHouse(object: PlaceableObject, level: DisplayLevel): Drawable[] {
	const { surfaces, hatch, fillAlpha } = houseLevels[level];
	if (!surfaces) return [];
	const table: SurfaceAssignment = surfaces;
	const assignment = Object.fromEntries(object.slots.map((slot) => [slot, table[slot]]));
	return resolveSurfaces(object, assignment).map((drawable) => ({
		...drawable,
		...(hatch ? { hatch } : {}),
		...(fillAlpha < 1 ? { fillAlpha, occlude: true } : {})
	}));
}
