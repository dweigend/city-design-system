/** Module: Projects house objects and their cladding into the shared stage. */

import type { PlaceableObject } from '../../core/object';
import { defaults } from '../../../config/house-projection';
import type { DisplayLevel } from '../focus';
import { resolveSurfaces, type Drawable, type SurfaceAssignment } from '../surface';
import { houseLevels } from './levels';

export { houseLevels } from './levels';
/** Claddings of house faces, their placement and the clad house drawing. */
export {
	faceAreaM2,
	houseCladdings,
	projectCladHouse,
	type CladHouseOptions,
	type HousePlacement
} from './clad';
/** Model materials per style row and role, and one house's draw of them. */
export {
	houseMaterials,
	planHouseMaterials,
	type HouseMaterials,
	type MaterialRole
} from './materials';

/** The salience rule: which houses of a view are granted detail beyond the plain default. */
export { readHouseSalience, type SalienceCandidate } from './salience';
export { paintHouseUse, projectProgrammedHouse } from './program';

/** Cladding triangles of one block of houses at the near level. */
export const blockTriangleBudget = defaults.blockTriangleBudget;

const { sheetGapM } = defaults;

/** Gap in meters between houses laid side by side on one sheet. */
export const houseSheetGapM = sheetGapM;

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
