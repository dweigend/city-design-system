import type { Vec3 } from '../parametrik/types';
import type { Terrain } from '../terrain';
import type { TerrainCell, TerrainGrid } from './types';

/** Edge length of a redraw chunk, in cells. */
export const CHUNK_CELLS = 16;
type Columns<T> = (readonly T[])[];
type Storage = { vertices: Columns<Vec3>; cells: Columns<TerrainCell> };
const storage = new WeakMap<TerrainGrid, Storage>();

function ordered<T>(columns: Columns<T>, rows: number) {
	return Array.from(
		{ length: columns.length * rows },
		(_, i) => columns[i % columns.length][Math.floor(i / columns.length)]
	);
}

/** Copy only the column directories. Untouched columns belong to both snapshots. */
export function columnStorage(previous?: TerrainGrid): Storage {
	const old = previous && storage.get(previous);
	if (previous && !old) {
		// A structurally constructed grid is also a valid predecessor.
		const column = <T>(flat: readonly T[], width: number, c: number) =>
			Array.from({ length: flat.length / width }, (_, r) => flat[r * width + c]);
		return {
			cells: Array.from({ length: previous.columns }, (_, c) =>
				column(previous.cells, previous.columns, c)
			),
			vertices: Array.from({ length: previous.columns + 1 }, (_, c) =>
				column(previous.vertices, previous.columns + 1, c)
			)
		};
	}
	return { vertices: old?.vertices.slice() ?? [], cells: old?.cells.slice() ?? [] };
}

/** Row-major map view over stable lattice addresses, with no per-cell index allocation. */
class CellIndex implements ReadonlyMap<string, TerrainCell> {
	constructor(
		private columns: Columns<TerrainCell>,
		private rows: number
	) {}
	get size() {
		return this.columns.length * this.rows;
	}
	get(id: string) {
		const slash = id.indexOf('/');
		const column = Number(id.slice(0, slash)),
			row = Number(id.slice(slash + 1));
		const cell = this.columns[column]?.[row];
		return cell?.id === id ? cell : undefined;
	}
	has(id: string) {
		return this.get(id) !== undefined;
	}
	*values(): Generator<TerrainCell, undefined> {
		for (let r = 0; r < this.rows; r++) for (const column of this.columns) yield column[r];
	}
	*keys(): Generator<string, undefined> {
		for (const cell of this.values()) yield cell.id;
	}
	*entries(): Generator<[string, TerrainCell], undefined> {
		for (const cell of this.values()) yield [cell.id, cell];
	}
	[Symbol.iterator]() {
		return this.entries();
	}
	forEach(
		fn: (value: TerrainCell, key: string, map: ReadonlyMap<string, TerrainCell>) => void,
		thisArg?: unknown
	) {
		for (const cell of this.values()) fn.call(thisArg, cell, cell.id, this);
	}
}

/** Publish the new columns and affected chunks. Flatten only on a bulk array read. */
export function assemble(
	terrain: Terrain,
	profile: TerrainGrid['profile'],
	data: Storage,
	first: number,
	last: number,
	previous?: TerrainGrid
): TerrainGrid {
	const columns = data.cells.length,
		rows = data.cells[0].length;
	const chunks = new Map(previous?.chunks);
	for (let r = 0; r < rows; r += CHUNK_CELLS) {
		for (let c = Math.floor(first / CHUNK_CELLS) * CHUNK_CELLS; c <= last; c += CHUNK_CELLS) {
			const firstCell = data.cells[c][r],
				old = previous?.chunks.get(firstCell.chunk);
			if (old?.every((cell) => data.cells[cell.column][cell.row] === cell)) continue;
			const list: TerrainCell[] = [];
			for (let y = r; y < Math.min(r + CHUNK_CELLS, rows); y++)
				for (let x = c; x < Math.min(c + CHUNK_CELLS, columns); x++) list.push(data.cells[x][y]);
			chunks.set(list[0].chunk, list);
		}
	}
	let vertices: Vec3[] | undefined, cells: TerrainCell[] | undefined;
	const grid = {
		profile,
		terrain,
		columns,
		rows,
		chunks,
		cellsById: new CellIndex(data.cells, rows),
		get cells() {
			return (cells ??= ordered(data.cells, rows));
		},
		get vertices() {
			return (vertices ??= ordered(data.vertices, rows + 1));
		}
	};
	storage.set(grid, data);
	return grid;
}
