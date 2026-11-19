import { neighborsOf, type QuadCell } from '../quad-grid';
import { valleyCoords } from '../terrain';
import { MODULE, MAX_SHIFT, MAX_LEAN } from './contour-rows';
import { cellId } from './types';
import type { TerrainGrid, TerrainCell } from './types';
/** Rows a cell may lie from its lattice row; bounds the search of `cellAtPoint`. */
const ROW_SEARCH = Math.ceil(MAX_SHIFT / MODULE) + 1;
const COLUMN_SEARCH = Math.ceil((MAX_LEAN + 16) / MODULE);
/** True if the ground point lies inside or on the counter-clockwise quad of the cell. */
function contains(cell: QuadCell, x: number, y: number): boolean {
	return cell.corners.every((a, i) => {
		const b = cell.corners[(i + 1) % 4];
		return (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) >= 0;
	});
}

/**
 * Cell under a world ground point, or undefined outside the grid. Points on a shared side
 * belong to the cell with the lower index. Cost: a fixed window around the lattice position.
 */
export function cellAtPoint(grid: TerrainGrid, x: number, y: number): TerrainCell | undefined {
	const [along, across] = valleyCoords(grid.terrain, x, y);
	const column = Math.floor(along / MODULE);
	const row = Math.floor(across / MODULE);
	for (let r = Math.max(0, row - ROW_SEARCH); r <= Math.min(grid.rows - 1, row + ROW_SEARCH); r++)
		for (
			let c = Math.max(0, column - COLUMN_SEARCH);
			c <= Math.min(grid.columns - 1, column + COLUMN_SEARCH);
			c++
		) {
			const cell = grid.cellsById.get(cellId(c, r));
			if (cell && contains(cell, x, y)) return cell;
		}
	return undefined;
}

function connectedPath(grid: TerrainGrid, from: TerrainCell, to: TerrainCell) {
	const dx = to.center[0] - from.center[0],
		dy = to.center[1] - from.center[1];
	const deviation = (c: TerrainCell) =>
		Math.abs(dx * (c.center[1] - from.center[1]) - dy * (c.center[0] - from.center[0]));
	const queue = [from],
		parent = new Map<string, TerrainCell | undefined>([[from.id, undefined]]);
	for (let i = 0; i < queue.length; i++) {
		const cell = queue[i];
		if (cell === to) break;
		const next = neighborsOf(grid, cell)
			.filter((c) => !parent.has(c.id))
			.sort((a, b) => deviation(a) - deviation(b));
		for (const n of next) {
			parent.set(n.id, cell);
			queue.push(n);
		}
	}
	const path = [];
	for (let c: TerrainCell | undefined = to; c; c = parent.get(c.id)) path.push(c);
	return path.reverse();
}

/**
 * Cells on the straight lattice line from one cell to another, both ends included, each step
 * to a side neighbor. Specific to this column/row lattice; brush strokes use it to close the
 * gaps a fast pointer leaves. Unknown ids return an empty list.
 */
export function cellsBetween(grid: TerrainGrid, fromId: string, toId: string): TerrainCell[] {
	const from = grid.cellsById.get(fromId);
	const to = grid.cellsById.get(toId);
	if (!from || !to) return [];
	const columns = Math.abs(to.column - from.column);
	const rows = Math.abs(to.row - from.row);
	const stepColumn = Math.sign(to.column - from.column);
	const stepRow = Math.sign(to.row - from.row);
	const cells = [from];
	let { column, row } = from;
	// Integer error term of the line: positive means the row lags behind.
	let error = columns - rows;
	while (column !== to.column || row !== to.row) {
		if (error > 0 || row === to.row) {
			column += stepColumn;
			error -= 2 * rows;
		} else {
			row += stepRow;
			error += 2 * columns;
		}
		const next = grid.cellsById.get(cellId(column, row));
		if (next) {
			const last = cells[cells.length - 1];
			if (last.neighbors.includes(next.id)) cells.push(next);
			else cells.push(...connectedPath(grid, last, next).slice(1));
		}
	}
	return cells;
}
