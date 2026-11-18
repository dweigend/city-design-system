/**
 * Carrier contract for everything that is painted onto cells: a grid of quads with stable
 * identities, side neighbors and a level datum per cell. Brushes read only this contract,
 * so one rule works on a square grid, an irregular quad mesh or a grid draped over terrain
 * (PT-1 to PT-3). Independent core module.
 */
import type { Vec3 } from '../parametrik/types';

export type QuadCell = Readonly<{
	/** Stable identity from the rule path of the grid, never from coordinates or indices. */
	id: string;
	/** Dense label for hashing; not an identity. */
	index: number;
	/** World corners in meters, counter-clockwise seen from above; z is the ground height. */
	corners: readonly [Vec3, Vec3, Vec3, Vec3];
	/** Identities of the four corners; neighbors share them. Topology reads these, never positions. */
	vertexIds: readonly [string, string, string, string];
	center: Vec3;
	/** Neighbor across side i (corner i → corner i + 1), or null at the rim. */
	neighbors: readonly [string | null, string | null, string | null, string | null];
	/** Level datum in meters: floor height of story 0. Equal pads let neighbors merge. */
	pad: number;
	/** True where the ground floods: the datum is raised and buildings stand on stilts. */
	raised: boolean;
	/** False where nothing can stand, e.g. open water. */
	buildable: boolean;
	/** Identity of the chunk the cell belongs to; chunks bound the work of one local edit. */
	chunk: string;
}>;

export type QuadGrid<C extends QuadCell = QuadCell> = Readonly<{
	/** Ordered by `index`. */
	cells: readonly C[];
	cellsById: ReadonlyMap<string, C>;
	/** Cells per chunk, each list in index order. */
	chunks: ReadonlyMap<string, readonly C[]>;
}>;

/** Assembles the lookup tables of a grid from its cells (in index order). */
export function quadGrid<C extends QuadCell>(cells: readonly C[]): QuadGrid<C> {
	const chunks = new Map<string, C[]>();
	for (const cell of cells) {
		const list = chunks.get(cell.chunk);
		if (list) list.push(cell);
		else chunks.set(cell.chunk, [cell]);
	}
	return { cells, cellsById: new Map(cells.map((cell) => [cell.id, cell])), chunks };
}

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
	const chunks = new Set<string>();
	after.cells.forEach((cell, i) => {
		if (before.cells[i] !== cell) chunks.add(cell.chunk);
	});
	return chunks;
}
