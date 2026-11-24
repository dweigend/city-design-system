import type { CellSpace } from '../cell-space';
import { side } from './boxes';
import type { HouseCourt } from './occupancy';

/** What makes a house give orientation in a picture (MAT-15): its tallest storey count, whether
 * it turns a corner (frontage on two sides that meet at an angle) and whether it is a large house
 * over merged units. */
export type HouseFeatures = Readonly<{ storeys: number; corner: boolean; large: boolean }>;

// Exact arithmetic: a corner turns by more than the cosine of sixty degrees.
const cornerCosine = 1 / 2;

/** Reads the salience features of a house from its cell space and occupancy. */
// Exact arithmetic: storeys start at zero.
export function readHouseFeatures(space: CellSpace, house: HouseCourt): HouseFeatures {
	const normals = space.cells.flatMap((cell) =>
		cell.sides.flatMap(({ frontage }, i) => (frontage ? [side(cell.quad, i).normal] : []))
	);
	const corner = normals.some((a) => normals.some((b) => a[0] * b[0] + a[1] * b[1] < cornerCosine));
	const storeys = Math.max(0, ...house.cells.map(({ toStorey }) => toStorey));
	return { storeys, corner, large: house.scale === 'large' };
}
