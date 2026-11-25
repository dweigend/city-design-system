import type { Random } from '../../core/random';
import { cellCenter, type CellSpace, type FineCell } from '../cell-space';
import { defaults } from '../../../config/house-court';
import { inradius } from './solids';
import type { Vec2 } from '../../core/geometry';
import type { HouseCell, HouseOccupancy } from '../massing';
import type { HouseStyle } from './styles';
import type { AdjoiningWall } from './wall-contact';

/** Reads occupancy and geometry of one cell in a fixed space and house. */
export type Context = Readonly<{
	space: CellSpace;
	occupancy: ReadonlyMap<string, HouseCell>;
	style: HouseStyle;
	random: Random;
	complexity: number;
	house: HouseOccupancy;
	adjoiningWalls: readonly AdjoiningWall[];
}>;

/** True when a cell holds closed volume in the given storey. */
export function builtAt(context: Context, id: string | null, storey: number): boolean {
	const cell = id === null ? undefined : context.occupancy.get(id);
	return !!cell && storey >= cell.fromStorey && storey < cell.toStorey;
}

export function programAt(ctx: Context, cell: FineCell, storey: number) {
	return ctx.occupancy.get(cell.id)?.program?.find((row) => row.storey === storey);
}

/** An upper envelope layer keeps its walls, roof and exposed frame on the same inset ring. */
export function envelopeRing(ctx: Context, cell: FineCell, storey: number) {
	if (programAt(ctx, cell, storey)?.phase !== 'addition') return cell.quad;
	const [cx, cy] = cellCenter(cell);
	const share = Math.min(defaults.additionSetbackM / inradius(cell.quad), defaults.insetLimitRatio);
	// Move every edge inward while keeping its side index for windows and frame posts.
	return cell.quad.map(([x, y]): Vec2 => [x + (cx - x) * share, y + (cy - y) * share]);
}
