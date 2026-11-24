import { createCellSpace, type CellSpace } from '../../domain/cell-space';
import { storeysPerLevel, type CityColumn } from '../../domain/city-volume';
import { createHouseCourt, type HouseCourt, type HouseInputs } from '../../domain/house-court';

/** A house rule placed on one city column: its cell space and occupancy, in world meters. */
export type BayHouse = Readonly<{ space: CellSpace; house: HouseCourt }>;

/** Places the court-house rule on the ground bay of a city column. The column's plan corners
 * (counterclockwise, keyed by plan vertex ID) become the parcel, so the corner quads carry the
 * logical child addresses of `subdivideBay` and storey `2L + h` of corner quad `<cell>/child/["v"]`
 * is child bay `<cell>/level/L/child/["v",h]`. The house stands on the highest corner, may rise
 * through the column's levels, and fronts the given plan edges (edge i runs from corner i to
 * corner i + 1). Invalid columns or edges throw RangeError. */
export function createBayHouse(
	column: CityColumn,
	frontage: readonly number[],
	inputs: HouseInputs
): BayHouse {
	const corners = column.corners.map(({ id, position: [x, y] }) => ({
		id,
		position: [x, y] as const
	}));
	const space = createCellSpace({
		id: column.planCellId,
		corners,
		frontage,
		baseZ: Math.max(...column.corners.map(({ position }) => position[2])),
		storeyCount: column.levels * storeysPerLevel
	});
	return Object.freeze({ space, house: createHouseCourt(space, inputs) });
}
