import type { QuadCell, QuadGrid } from '../quad-grid';
import type { Vec3 } from '../parametrik/types';
import type { Terrain, TerrainZone } from '../terrain';
import type { Pattern } from './patterns';

export type BankSurface = { divisions: number; points: Vec3[]; shade: number[]; indices: number[] };

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
		/** Kernel parcel owning this addressable carrier cell. */
		parcel: string;
		/** Access of the accepted leaf or undivided court, shared by its carriers. */
		parcelAccess?: 'fronted' | 'landlocked';
		blockSides: number;
		/** The full cell is dry and free of circulation reservations for land cover. */
		plantable: boolean;
		/** Buildable remainder where an alley takes part of the terrain cell. */
		lotCorners?: QuadCell['corners'];
		alleyEdges: number;
		/** Local court cut and fill sampled on the parcel's triangular chart. */
		bank?: BankSurface;
	}>;

/** Surveyed court side with its outward normal and the extent of the graded bank in metres. */
export type CourtFront = {
	courtId: string;
	edge: number;
	a: readonly [number, number];
	b: readonly [number, number];
	nx: number;
	ny: number;
	pavingZ: number;
	reach: number;
};

export type TerrainGrid = QuadGrid<TerrainCell> &
	Readonly<{
		courtFronts?: readonly CourtFront[];
		profile: typeof import('./alley-profile').defaultAlleyPlan;
		terrain: Terrain;
		columns: number;
		rows: number;
		/** Lattice vertices, row-major with `columns + 1` per row; shared between cells. */
		vertices: readonly Vec3[];
	}>;

/** Stable lattice address of a cell or vertex. */
export const cellId = (column: number, row: number) => `${column}/${row}`;
