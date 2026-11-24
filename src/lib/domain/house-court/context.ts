import type { Random } from '../../core/random';
import type { CellSpace } from '../cell-space';
import type { HouseCell, HouseCourt } from './occupancy';
import type { HouseStyle } from './styles';

/** Reads occupancy and geometry of one cell in a fixed space and house. */
export type Context = Readonly<{
	space: CellSpace;
	occupancy: ReadonlyMap<string, HouseCell>;
	style: HouseStyle;
	random: Random;
	complexity: number;
	house: HouseCourt;
}>;

/** True when a cell holds closed volume in the given storey. */
export function builtAt(context: Context, id: string | null, storey: number): boolean {
	const cell = id === null ? undefined : context.occupancy.get(id);
	return !!cell && storey >= cell.fromStorey && storey < cell.toStorey;
}
