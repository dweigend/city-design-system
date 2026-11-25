/** Module: Projects house objects and their cladding into the shared stage. */

import type { PlaceableObject } from '../../core/object';
import { defaults } from '../../../config/house-projection';
import type { DisplayLevel } from '../focus';
import { resolveSurfaces, type Drawable, type SurfaceAssignment } from '../surface';
import { houseLevels } from './levels';

/** The drawing of a house at each display level of COLOR-6: which object detail it reads and how the slots look. `hidden` draws nothing. */
export { houseLevels } from './levels';
/** Claddings of house faces, their placement and the clad house drawing. */
export {
	/** Plan area of a face in square meters, its outline (or rectangle) less its openings. */
	faceAreaM2,
	/** Allocates the face cladding triangle budget by area and shares each body's pattern frame. */
	houseCladdings,
	/** Draws a house object as a model (MAT-3) at one display level. */
	projectCladHouse,
	/** Triangle budget, placement, material seed, and requested surface detail for the clad drawing (MAT-2). */
	type CladHouseOptions,
	/** Rotation in radians about world Z followed by translation in meters. */
	type HousePlacement
} from './clad';
/** Model materials per style row and role, and one house's draw of them. */
export {
	/** The material assignment of every style row. */
	houseMaterials,
	/** Draws one material per role, deterministically keyed by house and seed. */
	planHouseMaterials,
	/** Material choices by role and material roles by house slot. */
	type HouseMaterials,
	/** Dominant body, contrasting body, accent, or roof tone in the house palette (MAT-10). */
	type MaterialRole
} from './materials';

/** The salience rule: which houses of a view are granted detail beyond the plain default. */
export {
	/** Assigns surface detail from focus and house features within block and viewport caps (MAT-15). */
	readHouseSalience,
	/** House and block IDs, orientation features, and interaction state used to rank drawing detail. */
	type SalienceCandidate
} from './salience';
/** Applies the semantic palette during use focus and supplies the legend's tokens. */
export {
	/** Applies the house function palette using the existing drawable geometry. */
	paintHouseUse,
	/** CSS color token by house use for use focus and its legend. */
	houseUseColors
} from './use-surfaces';
/** Projects programmed houses with the standard detail levels and triangle budget. */
export { projectProgrammedHouse } from './program';

/** Cladding triangles of one block of houses at the near level. */
export const blockTriangleBudget = defaults.blockTriangleBudget;

const { sheetGapM } = defaults;

/** Gap in meters between houses laid side by side on one sheet. */
export const houseSheetGapM = sheetGapM;

/** Object detail the level needs: `full` or `block`. */
export function readHouseDetail(level: DisplayLevel) {
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
