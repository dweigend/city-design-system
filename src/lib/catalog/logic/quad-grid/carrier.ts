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
	/** Frontage side determining the ridge direction when the carrier supplies one. */
	ridgeSide?: number;
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
