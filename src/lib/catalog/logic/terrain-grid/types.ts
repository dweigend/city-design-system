import type { QuadCell, QuadGrid } from '../quad-grid';
import type { Vec3 } from '../parametrik/types';
import type { Terrain, TerrainZone } from '../terrain';
import type { Pattern } from './patterns';

export type TerrainCell = QuadCell &
	Readonly<{
		/** Lattice position; the id `column/row` is the stable anchor of everything painted. */
		plan: ReturnType<typeof import('./alley-plan').alleyPlan>;
		column: number;
		row: number;
		zone: TerrainZone;
		pattern: Pattern;
		alley: 'along' | 'across' | 'both' | null;
		block: string;
		blockSides: number;
		alleyEdges: number;
	}>;

export type TerrainGrid = QuadGrid<TerrainCell> &
	Readonly<{
		profile: typeof import('./alley-profile').defaultAlleyPlan;
		terrain: Terrain;
		columns: number;
		rows: number;
		/** Lattice vertices, row-major with `columns + 1` per row; shared between cells. */
		vertices: readonly Vec3[];
	}>;

/** Stable lattice address of a cell or vertex. */
export const cellId = (column: number, row: number) => `${column}/${row}`;
