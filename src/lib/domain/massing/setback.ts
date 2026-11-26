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
	const entranceCells = new Set(massing.base.entrances.flat());
	clipColumns(columns, distance, entranceCells, startStorey, depth, stepStoreys);
	pruneOverhangs(columns, entranceCells, startStorey);
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
	entranceCells: ReadonlySet<string>,
	startStorey: number,
	depth: number,
	stepStoreys: number
) {
	for (const [id, column] of columns) {
		const hopsToEdge = distance.get(id);
		if (hopsToEdge === undefined) continue;
		const floor = entranceCells.has(id) ? column.base.fromStorey + 1 : column.base.fromStorey;
		const cap = Math.max(floor, startStorey + Math.floor(hopsToEdge / depth) * stepStoreys);
		for (const storey of column.occupied) if (storey >= cap) removeSlice(column, storey);
	}
}

function pruneOverhangs(columns: Columns, entranceCells: ReadonlySet<string>, startStorey: number) {
	for (const [id, column] of columns)
		for (const storey of column.occupied) {
			if (entranceCells.has(id) && storey === column.base.fromStorey) continue;
			if (storey >= startStorey && !supports(columns, column, storey)) removeSlice(column, storey);
		}
}
