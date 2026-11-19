import { sandboxGenerationYears } from '../../data/sandbox';
import { clearInstallation, lostSeat, removeInstallations } from './installation-record';
import { lower, raise, storiesOf, type HouseUse } from '../house-brush';
import { setCover } from '../land-cover';
import { createTerrain, type TerrainEdit } from '../terrain';
import { deriveGrid, regrid, type TerrainCell, type TerrainGrid } from '../terrain-grid';
import { routeLine, transitOverrides, type TransitLine } from '../transit-line';
import { seedTown, type TownOptions } from './old-town';
import { migrateSnapshot } from './snapshot';
import { constructionLayers } from './time-layers';
import {
	stylesForYear,
	type Edit,
	type LineStroke,
	type SandboxSnapshot,
	type SandboxState,
	type Store,
	type StoryPart
} from './state';

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
	lines: readonly BuiltLine[];
}>;

export type BuiltLine = TransitLine & { year: number };

function route(grid: TerrainGrid, strokes: readonly LineStroke[]): BuiltLine[] {
	return strokes.flatMap((stroke) => {
		const line = routeLine(
			grid,
			{ id: stroke.id, kind: stroke.transit, cellIds: stroke.cellIds },
			stroke.profile
		);
		return line ? [{ ...line, year: stroke.year }] : [];
	});
}

const stored = (store: Store, use: HouseUse, count: number): Store => ({
	...store,
	[use]: Math.max(0, store[use] + count)
});

function waterOrGroundRoute(cell: TerrainCell | undefined) {
	return cell?.zone === 'water' || (!!cell?.alley && !cell.plan.footbridge);
}

function alleyOccupiesLot(cell: TerrainCell) {
	return !!cell.alley && !cell.lotCorners;
}

function lostHouseSite(before: TerrainCell, after: TerrainCell) {
	if (after.buildable || before === after) return false;
	return (
		before.buildable ||
		(after.plan.open && !before.plan.open) ||
		(after.zone === 'water' && before.zone !== 'water') ||
		(after.plan.square && !before.plan.square) ||
		(alleyOccupiesLot(after) && !alleyOccupiesLot(before))
	);
}

/** Return storeys to the material store when an intervention takes away their site. */
function settleHouses(previous: TerrainGrid, grid: TerrainGrid, state: SandboxState): SandboxState {
	let { stacks, store, storyParts } = state;
	for (const [cellId, stories] of state.stacks) {
		const before = previous.cellsById.get(cellId);
		const after = grid.cellsById.get(cellId);
		if (!before || !after || !lostHouseSite(before, after)) continue;
		for (const use of stories) {
			store = stored(store, use, 1);
			stacks = lower(stacks, cellId);
		}
		storyParts = partsAt(storyParts, cellId, []);
	}
	return stacks === state.stacks ? state : { ...state, stacks, store, storyParts };
}

function settleCover(grid: TerrainGrid, state: SandboxState, previous?: TerrainGrid): SandboxState {
	let cover = state.cover;
	for (const cellId of state.cover.keys()) {
		const cell = grid.cellsById.get(cellId);
		const lostPlantingGround = previous?.cellsById.get(cellId)?.plantable && !cell?.plantable;
		if (waterOrGroundRoute(cell) || lostPlantingGround) cover = setCover(cover, cellId, undefined);
	}
	return cover === state.cover ? state : { ...state, cover };
}

/** A new world with a seeded old town on the terrain of a seed. */
export function createWorld(
	seed: number,
	options?: TownOptions & { plan?: Parameters<typeof deriveGrid>[1] }
): World {
	const grid = deriveGrid(createTerrain({ seed }), options?.plan);
	return { seed: grid.terrain.seed, state: seedTown(grid, options), grid, lines: [] };
}

/**
 * Restores a snapshot on the same seed, migrating missing construction methods and time layers.
 * Preserves existing houses and clears cover from water and ground routes.
 */
export function withState(world: World, snapshot: SandboxSnapshot): World {
	return replaceState(world, migrateSnapshot(snapshot), 'restore');
}

function replaceState(world: World, state: SandboxState, source: 'edit' | 'restore'): World {
	const grid =
		state.edits === world.state.edits
			? world.grid
			: regrid(world.grid, createTerrain({ seed: world.seed, edits: state.edits }));
	if (source === 'restore') state = settleCover(grid, state);
	else if (grid !== world.grid) {
		state = removeInstallations(state, (part) => lostSeat(world.grid, grid, part));
		state = settleHouses(world.grid, grid, state);
		state = settleCover(grid, state, world.grid);
	}
	if (state === world.state) return world;
	const sameRoutes = grid === world.grid && state.lines === world.state.lines;
	return {
		seed: world.seed,
		state,
		grid,
		lines: sameRoutes ? world.lines : route(grid, state.lines)
	};
}

function partsAt(source: SandboxState['storyParts'], id: string, parts: readonly StoryPart[]) {
	const next = new Map(source);
	if (parts.length) next.set(id, parts);
	else next.delete(id);
	return next;
}
function raiseStory(
	state: SandboxState,
	cell: TerrainCell,
	{ use, style }: Extract<Edit, { kind: 'raise' }>
): SandboxState {
	const styles = stylesForYear(state.year);
	if (style && !styles.includes(style)) return state;
	const stacks = cell.buildable ? raise(state.stacks, cell.id, use) : state.stacks;
	if (stacks === state.stacks) return state;
	// A house replaces what grew on its cell and takes its module from the store first.
	return {
		...state,
		nextAction: state.nextAction + 1,
		storyParts: partsAt(state.storyParts, cell.id, [
			...(state.storyParts.get(cell.id) ?? []),
			{
				id: 'p/' + state.nextAction + '/0',
				anchor: { cellId: cell.id, level: storiesOf(state.stacks, cell.id).length },
				built: state.year,
				style: style ?? styles[0]
			}
		]),
		stacks,
		cover: setCover(state.cover, cell.id, undefined),
		store: stored(state.store, use, -1)
	};
}

const isInside = (edit: TerrainEdit, cell: TerrainCell) =>
	Math.hypot(cell.center[0] - edit.center[0], cell.center[1] - edit.center[1]) <= edit.radius;

function clearCell(state: SandboxState, cell: TerrainCell): SandboxState {
	const cleared = clearInstallation(state, cell);
	if (cleared !== state) return cleared;
	const stories = storiesOf(state.stacks, cell.id);
	if (stories.length) {
		const use = stories[stories.length - 1];
		return {
			...state,
			storyParts: partsAt(
				state.storyParts,
				cell.id,
				state.storyParts.get(cell.id)?.slice(0, -1) ?? []
			),
			stacks: lower(state.stacks, cell.id),
			store: stored(state.store, use, 1)
		};
	}
	if (state.cover.has(cell.id))
		return { ...state, cover: setCover(state.cover, cell.id, undefined) };
	const lines = state.lines.filter((line) => !line.cellIds.includes(cell.id));
	if (lines.length !== state.lines.length) return { ...state, lines };
	const edits = state.edits.filter((edit) => !isInside(edit, cell));
	return edits.length === state.edits.length ? state : { ...state, edits };
}

function cellEdit(
	state: SandboxState,
	cell: TerrainCell,
	edit: Exclude<Edit, { kind: 'line' | 'line-profile' | 'advance' }>
) {
	if (edit.kind === 'raise') return raiseStory(state, cell, edit);
	if (edit.kind === 'clear') return clearCell(state, cell);
	if (edit.kind === 'dig') {
		const basin: TerrainEdit = {
			kind: 'basin',
			center: [cell.center[0], cell.center[1]],
			radius: DIG_RADIUS
		};
		return { ...state, edits: [...state.edits, basin] };
	}
	if (!cell.plantable || storiesOf(state.stacks, cell.id).length) return state;
	const cover = setCover(state.cover, cell.id, edit.cover);
	return cover === state.cover ? state : { ...state, cover };
}

function setLineProfile(state: SandboxState, edit: Extract<Edit, { kind: 'line-profile' }>) {
	const index = state.lines.findIndex(({ id }) => id === edit.lineId);
	if (index < 0) return state;
	const { profile: previous, ...stroke } = state.lines[index];
	const profile = transitOverrides(stroke.transit, edit.profile);
	if (JSON.stringify(previous) === JSON.stringify(profile)) return state;
	const lines = state.lines.slice();
	lines[index] = profile ? { ...stroke, profile } : stroke;
	return { ...state, lines };
}

function advance(state: SandboxState, years: number): SandboxState {
	const year = state.year + years;
	if (!Number.isSafeInteger(years) || years <= 0 || !Number.isSafeInteger(year)) return state;
	const [layer] = constructionLayers(state, (built) => built === state.year);
	const timeLayers = layer ? [...state.timeLayers, layer] : state.timeLayers;
	return { ...state, year, timeLayers };
}

function nextState(world: World, edit: Edit): SandboxState {
	const { state } = world;
	if (edit.kind === 'advance') return advance(state, edit.years ?? sandboxGenerationYears);
	if (edit.kind === 'line-profile') return setLineProfile(state, edit);
	if (edit.kind === 'line') {
		const stroke = {
			year: state.year,
			id: 'line' + state.nextAction,
			transit: edit.transit,
			cellIds: edit.cellIds
		};
		return route(world.grid, [stroke]).length
			? { ...state, nextAction: state.nextAction + 1, lines: [...state.lines, stroke] }
			: state;
	}
	const cell = world.grid.cellsById.get(edit.cellId);
	return cell ? cellEdit(state, cell, edit) : state;
}

/**
 * Applies one edit. Pure: returns a new world, or the input itself when nothing changes
 * (unknown cell, full stack, open water, a line too short to route). After an intervention
 * in the terrain the grid follows, and houses on ground that fell away go to the store.
 * Time advances by the supplied positive whole years (25 by default). Unavailable
 * house styles and invalid advances leave the world unchanged.
 * A line profile replaces its overrides in schema units, or resets them when omitted.
 * An unknown line is a no-op. Invalid overrides throw RangeError before a new world is returned.
 */
export function applyEdit(world: World, edit: Edit): World {
	return replaceState(world, nextState(world, edit), 'edit');
}
