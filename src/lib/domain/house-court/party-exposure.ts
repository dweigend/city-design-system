import { readStoreyElevation, type CellSpace } from '../cell-space';
import { side } from './boxes';
import type { HouseOccupancy } from '../massing';
import { exposedWall, type AdjoiningWall } from './wall-contact';

/** Identifies the exposed portions of parcel-boundary storeys after adjoining occupancy.
 * The identity changes only when adjoining walls alter the coverage of an occupied side. */
// Exact arithmetic: a full run starts at its local origin.
export function readPartyWallExposure(
	space: CellSpace,
	house: HouseOccupancy,
	adjoining: readonly AdjoiningWall[]
): string {
	if (!adjoining.length) return '';
	const clipped = space.cells.flatMap((cell, index) => {
		const { fromStorey, toStorey } = house.cells[index];
		if (toStorey <= fromStorey) return [];
		const bottom = readStoreyElevation(space, fromStorey);
		const top = readStoreyElevation(space, toStorey);
		return cell.sides.flatMap(({ edge }, i) => {
			if (edge === null) return [];
			const wall = side(cell.quad, i);
			const open = exposedWall(adjoining, wall, bottom, top);
			const [first] = open;
			if (
				open.length === 1 &&
				first[0] === 0 &&
				first[1] === bottom &&
				first[2] === wall.length &&
				first[3] === top
			)
				return [];
			return [[index, i, open]];
		});
	});
	return clipped.length ? JSON.stringify(clipped) : '';
}
