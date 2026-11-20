export { boundaryRings, boundaryRuns, ringArea, direction, turn } from './outline';
import { quadGrid, type QuadGrid, type QuadCell } from './carrier';
export { quadGrid, type QuadGrid, type QuadCell } from './carrier';
export { patchGrid } from './patch';
/** Side neighbors of a cell that exist, in side order; cells at the rim have fewer than four. */
export function neighborsOf<C extends QuadCell>(grid: QuadGrid<C>, cell: QuadCell): C[] {
	return cell.neighbors.flatMap((id) => {
		const neighbor = id === null ? undefined : grid.cellsById.get(id);
		return neighbor ? [neighbor] : [];
	});
}

/** Length of side i of a cell in the ground plane, meters. */
export function sideLength(cell: QuadCell, side: number): number {
	const a = cell.corners[side];
	const b = cell.corners[(side + 1) % 4];
	return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/**
 * Radius in meters of the largest circle around the cell center that stays inside the cell:
 * the measure every round figure on a cell is sized by.
 */
export function inradius(cell: QuadCell): number {
	const [cx, cy] = cell.center;
	return Math.min(
		...cell.corners.map((a, i) => {
			const b = cell.corners[(i + 1) % 4];
			const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
			return ((b[0] - a[0]) * (cy - a[1]) - (b[1] - a[1]) * (cx - a[0])) / length;
		})
	);
}

/**
 * Flat grid of square cells with ids `column/row`: the plainest carrier, for examples and
 * comparison plates.
 * @param module edge length of a cell in meters
 * @param chunkCells edge length of a chunk in cells
 */
export function squareGrid(
	columns: number,
	rows: number,
	module: number,
	chunkCells = 16
): QuadGrid {
	const id = (column: number, row: number) =>
		column < 0 || row < 0 || column >= columns || row >= rows ? null : `${column}/${row}`;
	const cells: QuadCell[] = [];
	for (let row = 0; row < rows; row++)
		for (let column = 0; column < columns; column++) {
			const x = (column - columns / 2) * module;
			const y = (row - rows / 2) * module;
			cells.push({
				id: `${column}/${row}`,
				index: row * columns + column,
				latticeKey: row * columns + column,
				corners: [
					[x, y, 0],
					[x + module, y, 0],
					[x + module, y + module, 0],
					[x, y + module, 0]
				],
				vertexIds: [
					`${column}/${row}`,
					`${column + 1}/${row}`,
					`${column + 1}/${row + 1}`,
					`${column}/${row + 1}`
				],
				center: [x + module / 2, y + module / 2, 0],
				neighbors: [
					id(column, row - 1),
					id(column + 1, row),
					id(column, row + 1),
					id(column - 1, row)
				],
				pad: 0.5,
				raised: false,
				buildable: true,
				chunk: `${Math.floor(column / chunkCells)}:${Math.floor(row / chunkCells)}`
			});
		}
	return quadGrid(cells);
}

/**
 * Chunks whose cells differ between two grids of the same carrier, by object identity. A
 * derivation that reuses untouched cells makes this the exact set of chunks to redraw.
 */
export function changedChunks(before: QuadGrid, after: QuadGrid): Set<string> {
	const firstChanges: QuadCell[] = [];
	for (const [id, cells] of after.chunks) {
		if (before.chunks.get(id) === cells) continue;
		const first = cells.find((cell) => before.cellsById.get(cell.id) !== cell);
		if (first) firstChanges.push(first);
	}
	return new Set(firstChanges.sort((a, b) => a.index - b.index).map((cell) => cell.chunk));
}
