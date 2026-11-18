import type { FlowId } from '../../data/focus';
import { sandboxEpochs, townDefaults, type BuildingMethod } from '../../data/sandbox';
import type { HouseUse, Stacks } from '../house-brush';
import type { Cover, CoverKind } from '../land-cover';
import type { TerrainEdit } from '../terrain';
import type { TransitKind, TransitOverrides } from '../transit-line';

/** Identity stays with the floor when its cell geometry changes. */
export type StoryPart = Readonly<{
	id: string;
	anchor: Readonly<{ cellId: string; level: number }>;
	built: number;
	/** Optional on snapshots created before building methods were stored. */
	style?: BuildingMethod;
}>;

/** A line as the player drew it: the cells of the stroke. Its route is derived from the grid. */
export type LineStroke = Readonly<{
	id: string;
	year: number;
	transit: TransitKind;
	cellIds: readonly string[];
	profile?: TransitOverrides;
}>;

/** Modules in the material store per use: what deconstruction has set aside for reuse. */
export type Store = Readonly<Record<HouseUse, number>>;

/**
 * Everything the player has done, as intent: interventions in the terrain and what is
 * painted onto cells. Cell ids are the stable anchors; grid, routes and geometry are derived
 * and never stored. Plain immutable data; one authority per sandbox (A-51).
 */
export type SandboxState = Readonly<{
	year: number;
	timeLayers: readonly Readonly<{ year: number; flows: readonly FlowId[] }>[];
	nextAction: number;
	storyParts: ReadonlyMap<string, readonly StoryPart[]>;
	edits: readonly TerrainEdit[];
	stacks: Stacks;
	cover: Cover;
	lines: readonly LineStroke[];
	store: Store;
}>;

const EMPTY_STORE: Store = { living: 0, water: 0, energy: 0, food: 0, material: 0 };

export const EMPTY_STATE: SandboxState = {
	year: townDefaults.year,
	timeLayers: [],
	nextAction: 1,
	storyParts: new Map(),
	edits: [],
	stacks: new Map(),
	cover: new Map(),
	lines: [],
	store: EMPTY_STORE
};

/** One intent of the player. Cell ids refer to the sandbox grid. */
export type Edit =
	| { kind: 'advance'; years?: number }
	| { kind: 'raise'; cellId: string; use: HouseUse; style?: BuildingMethod }
	| { kind: 'cover'; cellId: string; cover: CoverKind }
	/** Digs a harbor basin around the cell. The grid and everything on it give way. */
	| { kind: 'dig'; cellId: string }
	/** Eraser: takes the top story, else the cover, else lines and basins at the cell. */
	| { kind: 'clear'; cellId: string }
	| { kind: 'line'; transit: TransitKind; cellIds: readonly string[] }
	/** Replaces a line's overrides with a sparse profile. Omit it to restore defaults. */
	| { kind: 'line-profile'; lineId: string; profile?: TransitOverrides };

/** The newest inclusive epoch's ordered styles, with the first style as its default. */
export function stylesForYear(year: number): readonly [BuildingMethod, ...BuildingMethod[]] {
	return (sandboxEpochs.findLast((epoch) => epoch.from <= year) ?? sandboxEpochs[0]).houseStyles;
}

/** Default style of an epoch, also used to read records without a stored style. */
export const styleForYear = (year: number): BuildingMethod => stylesForYear(year)[0];
