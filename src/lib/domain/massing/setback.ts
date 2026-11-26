import { defaults } from '../../../config/massing';
import type { CellSpace } from '../cell-space';
import { hops, onParcelEdge } from './graph';
import { columnsOf, removeSlice, snapshot, supports, type Columns, type Massing } from './massing';

/** Setback on the cell graph. Depth is in side hops per step, with zero disabling the cut. */
export type SetbackOptions = Readonly<{
	startStorey: number;
	depth: number;
	stepStoreys?: number;
	edge?: 'frontage' | 'perimeter';
}>;

/** Clips upper runs by increasing cell-hop depth from the selected edge. Returns the input on
 * a no-op. Start is a zero-based upper storey (at least 1). The step interval defaults to one
 * storey and the edge defaults to frontage. Invalid bounds or a mismatched space throw RangeError. */
export function createSetbackMassing(
	space: CellSpace,
	massing: Massing,
	{
		startStorey,
		depth,
		stepStoreys = defaults.setbackStepStoreys,
		edge = 'frontage'
	}: SetbackOptions
): Massing {
	validateSetback(startStorey, depth, stepStoreys);
	const columns = columnsOf(space, massing);
	if (depth === 0 || startStorey >= space.storeyCount) return massing;
	const edgeCells = space.cells.filter(({ sides }) =>
		sides.some((side) => onParcelEdge(side) && (edge === 'perimeter' || side.frontage))
	);
	const distance = hops(
		space,
		edgeCells.map(({ id }) => id)
	);
	clipColumns(columns, distance, startStorey, depth, stepStoreys);
	pruneOverhangs(columns, startStorey);
	return snapshot(massing, columns);
}

function validateSetback(startStorey: number, depth: number, stepStoreys: number) {
	if (!Number.isSafeInteger(startStorey) || startStorey < 1)
		throw new RangeError('Setback must start above the ground storey');
	if (
		!Number.isSafeInteger(depth) ||
		depth < 0 ||
		!Number.isSafeInteger(stepStoreys) ||
		stepStoreys < 1
	)
		throw new RangeError('Setback needs a nonnegative depth and a positive storey interval');
}

function clipColumns(
	columns: Columns,
	distance: ReadonlyMap<string, number>,
	startStorey: number,
	depth: number,
	stepStoreys: number
) {
	for (const [id, column] of columns) {
		const hopsToEdge = distance.get(id);
		if (hopsToEdge === undefined) continue;
		const cap = startStorey + Math.floor(hopsToEdge / depth) * stepStoreys;
		for (const storey of column.occupied) if (storey >= cap) removeSlice(column, storey);
	}
}

function pruneOverhangs(columns: Columns, startStorey: number) {
	for (const column of columns.values())
		for (const storey of column.occupied)
			if (storey >= startStorey && !supports(columns, column, storey)) removeSlice(column, storey);
}
