import type { CellSpace } from '../cell-space';

/** How the house rule reads a cell space: `calm` for a small town parcel, `large` for one
 * building over a large unit, `regular` for everything between (the R11 fixtures). */
export type HouseScale = 'calm' | 'regular' | 'large';

/** True when a cell side opens onto a shared court beyond the parcel. */
export function hasCourtAccess(space: CellSpace): boolean {
	return space.cells.some(({ sides }) => sides.some(({ court }) => court));
}
