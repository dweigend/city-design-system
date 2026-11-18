import type { HouseUse, Stacks } from '../house-brush';
import type { Cover, CoverKind } from '../land-cover';
import type { TerrainEdit } from '../terrain';
import type { TransitKind } from '../transit-line';

/** A line as the player drew it: the cells of the stroke. Its route is derived from the grid. */
export type LineStroke = Readonly<{ id: string; transit: TransitKind; cellIds: readonly string[] }>;

/** Modules in the material store per use: what deconstruction has set aside for reuse. */
export type Store = Readonly<Record<HouseUse, number>>;

/**
 * Everything the player has done, as intent: interventions in the terrain and what is
 * painted onto cells. Cell ids are the stable anchors; grid, routes and geometry are derived
 * and never stored. Plain immutable data; one authority per sandbox (A-51).
 */
export type SandboxState = Readonly<{
	edits: readonly TerrainEdit[];
	stacks: Stacks;
	cover: Cover;
	lines: readonly LineStroke[];
	store: Store;
}>;

const EMPTY_STORE: Store = { living: 0, water: 0, energy: 0, food: 0, material: 0 };

export const EMPTY_STATE: SandboxState = {
	edits: [],
	stacks: new Map(),
	cover: new Map(),
	lines: [],
	store: EMPTY_STORE
};

/** One intent of the player. Cell ids refer to the sandbox grid. */
export type Edit =
	| { kind: 'raise'; cellId: string; use: HouseUse }
	| { kind: 'cover'; cellId: string; cover: CoverKind }
	/** Digs a harbor basin around the cell. The grid and everything on it give way. */
	| { kind: 'dig'; cellId: string }
	/** Eraser: takes the top story, else the cover, else lines and basins at the cell. */
	| { kind: 'clear'; cellId: string }
	| { kind: 'line'; transit: TransitKind; cellIds: readonly string[] };
