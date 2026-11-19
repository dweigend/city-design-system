import type { TerrainGrid } from '../terrain-grid';
import type { TransitLine } from '../transit-line';
import type { SandboxState } from './state';
/**
 * A sandbox state together with everything derived from it: the terrain grid and the routed
 * lines. Derived parts are a cache with one owner, keyed by the state they came from.
 */
export type World = Readonly<{
	seed: number;
	roofBuilder?: import('../building-envelope').RoofBuilder;
	state: SandboxState;
	grid: TerrainGrid;
	/** Routes of `state.lines` on the current grid; a stroke too short to route is absent. */
	lines: readonly BuiltLine[];
}>;

export type BuiltLine = TransitLine & { year: number };
