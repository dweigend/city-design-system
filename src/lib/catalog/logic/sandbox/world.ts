import { lower, raise, storiesOf, type HouseUse } from '../house-brush';
import { setCover } from '../land-cover';
import { createTerrain, type TerrainEdit } from '../terrain';
import { deriveGrid, regrid, type TerrainCell, type TerrainGrid } from '../terrain-grid';
import { routeLine, type TransitLine } from '../transit-line';
import { EMPTY_STATE, type Edit, type LineStroke, type SandboxState, type Store } from './state';

/** Radius of a dug basin around its cell, meters. */
const DIG_RADIUS = 9;

/**
 * A sandbox state together with everything derived from it: the terrain grid and the routed
 * lines. Derived parts are a cache with one owner, keyed by the state they came from.
 */
export type World = Readonly<{
	seed: number;
	state: SandboxState;
	grid: TerrainGrid;
	/** Routes of `state.lines` on the current grid; a stroke too short to route is absent. */
	lines: readonly TransitLine[];
}>;

function route(grid: TerrainGrid, strokes: readonly LineStroke[]): TransitLine[] {
	return strokes.flatMap((stroke) => {
		const line = routeLine(grid, { id: stroke.id, kind: stroke.transit, cellIds: stroke.cellIds });
		return line ? [line] : [];
	});
}

const stored = (store: Store, use: HouseUse, count: number): Store => ({
	...store,
	[use]: Math.max(0, store[use] + count)
});

/**
 * Gives way where the ground fell away: stories on cells that can no longer carry a house
 * go to the material store, their cover goes. Returns the input if nothing has to yield.
 */
function settle(grid: TerrainGrid, state: SandboxState): SandboxState {
	let { stacks, cover, store } = state;
	for (const cellId of [...stacks.keys(), ...cover.keys()]) {
		if (grid.cellsById.get(cellId)?.buildable) continue;
		for (const use of storiesOf(stacks, cellId)) store = stored(store, use, 1);
		while (storiesOf(stacks, cellId).length) stacks = lower(stacks, cellId);
		cover = setCover(cover, cellId, undefined);
	}
	return stacks === state.stacks && cover === state.cover
		? state
		: { ...state, stacks, cover, store };
}

/** A new, empty world on the terrain of a seed. */
export function createWorld(seed: number): World {
	const grid = deriveGrid(createTerrain({ seed }));
	return { seed: grid.terrain.seed, state: EMPTY_STATE, grid, lines: [] };
}

/**
 * The world of another state on the same seed, e.g. after undo. The grid is derived again
 * only where the interventions differ; lines are routed again on the result.
 */
export function withState(world: World, state: SandboxState): World {
	if (state === world.state) return world;
	const grid =
		state.edits === world.state.edits
			? world.grid
			: regrid(world.grid, createTerrain({ seed: world.seed, edits: state.edits }));
	const sameRoutes = grid === world.grid && state.lines === world.state.lines;
	return {
		seed: world.seed,
		state,
		grid,
		lines: sameRoutes ? world.lines : route(grid, state.lines)
	};
}

/** Next free line identity: one above the highest number in use. */
function nextLineId(lines: readonly LineStroke[]): string {
	const highest = Math.max(0, ...lines.map((line) => Number(line.id.slice('line'.length))));
	return `line${highest + 1}`;
}

function raiseStory(state: SandboxState, cell: TerrainCell, use: HouseUse): SandboxState {
	const stacks = cell.buildable ? raise(state.stacks, cell.id, use) : state.stacks;
	if (stacks === state.stacks) return state;
	// A house replaces what grew on its cell and takes its module from the store first.
	return {
		...state,
		stacks,
		cover: setCover(state.cover, cell.id, undefined),
		store: stored(state.store, use, -1)
	};
}

const isInside = (edit: TerrainEdit, cell: TerrainCell) =>
	Math.hypot(cell.center[0] - edit.center[0], cell.center[1] - edit.center[1]) <= edit.radius;

function clearCell(state: SandboxState, cell: TerrainCell): SandboxState {
	const stories = storiesOf(state.stacks, cell.id);
	if (stories.length) {
		const use = stories[stories.length - 1];
		return { ...state, stacks: lower(state.stacks, cell.id), store: stored(state.store, use, 1) };
	}
	if (state.cover.has(cell.id))
		return { ...state, cover: setCover(state.cover, cell.id, undefined) };
	const lines = state.lines.filter((line) => !line.cellIds.includes(cell.id));
	if (lines.length !== state.lines.length) return { ...state, lines };
	const edits = state.edits.filter((edit) => !isInside(edit, cell));
	return edits.length === state.edits.length ? state : { ...state, edits };
}

function cellEdit(state: SandboxState, cell: TerrainCell, edit: Exclude<Edit, { kind: 'line' }>) {
	if (edit.kind === 'raise') return raiseStory(state, cell, edit.use);
	if (edit.kind === 'clear') return clearCell(state, cell);
	if (edit.kind === 'dig') {
		const basin: TerrainEdit = {
			kind: 'basin',
			center: [cell.center[0], cell.center[1]],
			radius: DIG_RADIUS
		};
		return { ...state, edits: [...state.edits, basin] };
	}
	if (!cell.buildable || storiesOf(state.stacks, cell.id).length) return state;
	const cover = setCover(state.cover, cell.id, edit.cover);
	return cover === state.cover ? state : { ...state, cover };
}

function nextState(world: World, edit: Edit): SandboxState {
	const { state } = world;
	if (edit.kind === 'line') {
		const stroke = { id: nextLineId(state.lines), transit: edit.transit, cellIds: edit.cellIds };
		return route(world.grid, [stroke]).length
			? { ...state, lines: [...state.lines, stroke] }
			: state;
	}
	const cell = world.grid.cellsById.get(edit.cellId);
	return cell ? cellEdit(state, cell, edit) : state;
}

/**
 * Applies one edit. Pure: returns a new world, or the input itself when nothing changes
 * (unknown cell, full stack, open water, a line too short to route). After an intervention
 * in the terrain the grid follows, and houses on ground that fell away go to the store.
 */
export function applyEdit(world: World, edit: Edit): World {
	const next = withState(world, nextState(world, edit));
	return next === world ? world : withState(next, settle(next.grid, next.state));
}
