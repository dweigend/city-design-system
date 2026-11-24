import { readBaseLevel } from './base';
import {
	createCellSpace,
	parcelEdgeId,
	type CellSpace,
	type FineCell
} from '../../domain/cell-space';
import { levelHeight, storeysPerLevel, type CityColumn } from '../../domain/city-volume';
import {
	createHouseCourt,
	houseStyles,
	type HouseCourt,
	type HouseInputs,
	type HouseStyle
} from '../../domain/house-court';

/** A house rule placed on one city column: its cell space, occupancy and the lattice level of the
 * cell space's storey 0, in world meters. */
export type BayHouse = Readonly<{ space: CellSpace; house: HouseCourt; baseLevel: number }>;

export { readBaseLevel } from './base';
export { createParcelHouse, createParcelHouseObject, type ParcelHouseSite } from './parcel';
export { createTownHouseStudy, type TownHouseBlock } from './parcel-town';

/** Places a house rule on a city column. The column's plan corners (counterclockwise, keyed by
 * plan vertex ID) become the parcel, its storeys stand on the lattice plane `readBaseLevel` above
 * the datum and fill the column's levels, two storeys per level, and the house fronts the plan
 * edges starting at the given corner indices (edge i runs from corner i to corner i + 1).
 * Invalid columns or edges throw RangeError. */
export function createBayHouse(
	column: CityColumn,
	datumZ: number,
	frontage: readonly number[],
	inputs: HouseInputs,
	style: HouseStyle = houseStyles.neutral
): BayHouse {
	const { corners } = column;
	const baseLevel = readBaseLevel(column, datumZ);
	const space = createCellSpace({
		id: column.planCellId,
		corners: corners.map(({ id, position: [x, y] }) => ({ id, position: [x, y] as const })),
		frontage: frontage.map((i) =>
			parcelEdgeId(corners[i]?.id ?? '', corners[(i + 1) % corners.length]?.id ?? '')
		),
		baseZ: datumZ + baseLevel * levelHeight,
		storeyCount: column.levels * storeysPerLevel,
		storeyHeightM: levelHeight / storeysPerLevel
	});
	return Object.freeze({ space, house: createHouseCourt(space, inputs, style), baseLevel });
}

/** The logical child bay of `subdivideBay` that holds one storey of a convex column's corner quad:
 * `<plan cell>/level/<base level + floor(storey / 2)>/child/<JSON [corner key, storey mod 2]>`.
 * Refined cells resolve to the child bay of their corner quad. */
export function readChildBayAddress(
	planCellId: string,
	baseLevel: number,
	cell: FineCell,
	storey: number
): string {
	if (!Number.isInteger(storey) || storey < 0) throw new RangeError('Expected a storey index');
	const level = baseLevel + Math.floor(storey / storeysPerLevel);
	return `${planCellId}/level/${level}/child/${JSON.stringify([cell.corner, storey % storeysPerLevel])}`;
}
