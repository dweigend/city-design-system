/**
 * Area grid derived from the terrain: quad cells of one module (5 m) whose rows follow the
 * contour lines and whose columns run across them. The grid is a pure function of the
 * terrain — nothing about it is stored. After an intervention only the columns in reach are
 * derived again; cells keep their identities, so everything painted onto them stays in place
 * and adapts to the new cell shapes.
 */
import type { Vec3 } from '../parametrik/types';
import { quadGrid, type QuadCell, type QuadGrid } from '../quad-grid';
import {
	editReach,
	FLOOD_LINE,
	groundLevel,
	terrainHeight,
	terrainZone,
	valleyCoords,
	valleyPoint,
	type Terrain,
	type TerrainEdit,
	type TerrainZone
} from '../terrain';
import { MODULE, REACH, rowShifts, type Lattice } from './contour-rows';

export { MODULE } from './contour-rows';
/** Height of a level datum above the ground: the visible foot of every building, meters. */
export const PLINTH = 0.5;
/** Datum of cells that flood, meters above mean water: decks stand on stilts there. */
export const FLOOD_DATUM = 4.5;
/** Edge length of a chunk in cells. */
const CHUNK_CELLS = 16;
/** Rows a cell may lie from its lattice row; bounds the search of `cellAtPoint`. */
const ROW_SEARCH = 4;
/** Smallest radial scale of the valley frame: world meters per frame meter along the valley. */
const FRAME_SCALE_MIN = 0.75;

export type TerrainCell = QuadCell &
	Readonly<{
		/** Lattice position; the id `column/row` is the stable anchor of everything painted. */
		column: number;
		row: number;
		zone: TerrainZone;
	}>;

export type TerrainGrid = QuadGrid<TerrainCell> &
	Readonly<{
		terrain: Terrain;
		columns: number;
		rows: number;
		/** Lattice vertices, row-major with `columns + 1` per row; shared between cells. */
		vertices: readonly Vec3[];
	}>;

export const cellId = (column: number, row: number) => `${column}/${row}`;

const latticeOf = (terrain: Terrain): Lattice => ({
	terrain,
	columns: Math.floor(terrain.along / MODULE),
	rows: Math.floor(terrain.across / MODULE)
});

function columnVertices(lattice: Lattice, column: number, shifts: Float64Array): Vec3[] {
	return Array.from(shifts, (shift, row): Vec3 => {
		const [x, y] = valleyPoint(lattice.terrain, column * MODULE, row * MODULE + shift);
		return [x, y, terrainHeight(lattice.terrain, x, y)];
	});
}

function makeCell(
	lattice: Lattice,
	vertices: readonly Vec3[],
	column: number,
	row: number
): TerrainCell {
	const { terrain, columns, rows } = lattice;
	const vertex = (c: number, r: number) => vertices[r * (columns + 1) + c];
	const corners = [
		vertex(column, row),
		vertex(column + 1, row),
		vertex(column + 1, row + 1),
		vertex(column, row + 1)
	] as const;
	const x = (corners[0][0] + corners[1][0] + corners[2][0] + corners[3][0]) / 4;
	const y = (corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) / 4;
	const level = groundLevel(terrain, x, y);
	const zone = terrainZone(terrain, x, y);
	const raised = level < FLOOD_LINE;
	const neighbor = (c: number, r: number) =>
		c < 0 || r < 0 || c >= columns || r >= rows ? null : cellId(c, r);
	return {
		id: cellId(column, row),
		index: row * columns + column,
		column,
		row,
		corners,
		vertexIds: [
			cellId(column, row),
			cellId(column + 1, row),
			cellId(column + 1, row + 1),
			cellId(column, row + 1)
		],
		center: [x, y, terrainHeight(terrain, x, y)],
		neighbors: [
			neighbor(column, row - 1),
			neighbor(column + 1, row),
			neighbor(column, row + 1),
			neighbor(column - 1, row)
		],
		zone,
		pad: raised ? terrain.waterLevel + FLOOD_DATUM : Math.round(level) + PLINTH,
		raised,
		buildable: zone !== 'water',
		chunk: `${Math.floor(column / CHUNK_CELLS)}:${Math.floor(row / CHUNK_CELLS)}`
	};
}

/** Derives vertex columns `from` … `to` and the cells that touch them; the rest is reused. */
function derive(lattice: Lattice, from: number, to: number, previous?: TerrainGrid): TerrainGrid {
	const { columns, rows } = lattice;
	const vertices = previous ? [...previous.vertices] : new Array<Vec3>((columns + 1) * (rows + 1));
	for (const [column, shifts] of rowShifts(lattice, from, to))
		columnVertices(lattice, column, shifts).forEach((point, row) => {
			vertices[row * (columns + 1) + column] = point;
		});
	const cells = previous ? [...previous.cells] : new Array<TerrainCell>(columns * rows);
	for (let row = 0; row < rows; row++)
		for (let column = Math.max(0, from - 1); column <= Math.min(columns - 1, to); column++)
			cells[row * columns + column] = makeCell(lattice, vertices, column, row);
	return { ...quadGrid(cells), terrain: lattice.terrain, columns, rows, vertices };
}

/**
 * Derives the whole grid from a terrain. Deterministic: the same terrain gives the same
 * grid. The result is detached plain data.
 */
export function deriveGrid(terrain: Terrain): TerrainGrid {
	const lattice = latticeOf(terrain);
	return derive(lattice, 0, lattice.columns);
}

/** Vertex columns whose rows may move when the given interventions appear or disappear. */
function columnsInReach(lattice: Lattice, edits: readonly TerrainEdit[]): [number, number] {
	let from = Infinity;
	let to = -Infinity;
	for (const edit of edits) {
		const [along] = valleyCoords(lattice.terrain, edit.center[0], edit.center[1]);
		const reach = editReach(edit) / FRAME_SCALE_MIN;
		from = Math.min(from, Math.floor((along - reach) / MODULE) - REACH);
		to = Math.max(to, Math.ceil((along + reach) / MODULE) + REACH);
	}
	return [Math.max(0, from), Math.min(lattice.columns, to)];
}

/**
 * Derives the grid of a changed terrain from the grid of its predecessor. Only the columns
 * in reach of the interventions that differ are derived again; untouched cells are the same
 * objects as before. The result equals `deriveGrid(terrain)`. A different seed derives all.
 */
export function regrid(previous: TerrainGrid, terrain: Terrain): TerrainGrid {
	if (terrain.seed !== previous.terrain.seed) return deriveGrid(terrain);
	const before = new Set(previous.terrain.edits);
	const after = new Set(terrain.edits);
	const differing = [
		...previous.terrain.edits.filter((edit) => !after.has(edit)),
		...terrain.edits.filter((edit) => !before.has(edit))
	];
	if (!differing.length) return { ...previous, terrain };
	const lattice = latticeOf(terrain);
	const [from, to] = columnsInReach(lattice, differing);
	return derive(lattice, from, to, previous);
}

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
		for (let c = Math.max(0, column - 1); c <= Math.min(grid.columns - 1, column + 1); c++) {
			const cell = grid.cells[r * grid.columns + c];
			if (contains(cell, x, y)) return cell;
		}
	return undefined;
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
		cells.push(grid.cells[row * grid.columns + column]);
	}
	return cells;
}
