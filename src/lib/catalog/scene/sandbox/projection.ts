/**
 * Projection of sandbox worlds onto the stage: derives the parts that differ between two
 * worlds and hands them to the terrain and the structure layer. Nothing flows back (PP-2).
 */
import { focuses, present, type FocusId } from '../../logic/presentation';
import { plantingSurface } from './planting-surface';
import { forestChunk } from '../../logic/land-cover';
import {
	installationPartView,
	bankPlanting,
	cityCentreView,
	spongeWorkView,
	houseGroups,
	changes,
	type World
} from '../../logic/sandbox';
import { houseDistricts } from './house-districts';
import { roundedStops } from './station-rings';
import { cityTransitSlots, lineParts, TRANSIT_PARAMS } from '../../logic/transit-line';
import type { Structures } from './structures';
import type { TerrainMesh } from './terrain-mesh';

/** Keys of the structure layer per kind of derived part. */
export const KEY = {
	house: 'house:',
	forest: 'forest:',
	line: 'line:',
	installation: 'installation:',
	sponge: 'sponge:'
};

export type Target = Readonly<{
	terrain: TerrainMesh;
	structures: Pick<Structures, 'set'>;
	earliestFullYear?: number;
	coarse?: boolean;
	openingGroups?: Map<string, Parameters<Structures['set']>[1]>;
}>;

function projectCover(target: Target, after: World, cellIds: readonly string[]) {
	for (const cellId of cellIds) {
		const cell = after.grid.cellsById.get(cellId);
		if (cell) target.terrain.setCover(cell.index, after.state.cover.get(cellId));
	}
	if (cellIds.length) target.terrain.commitCover();
}

/** Updates the retained part batches, removing records erased or refunded by a regrid. */
export function projectInstallations(
	structures: Target['structures'],
	before: World,
	world: World,
	focus: FocusId,
	coarse = false
) {
	for (const id of before.state.parts.keys())
		if (!world.state.parts.has(id)) structures.set(KEY.installation + id, []);
	for (const p of world.state.parts.values())
		structures.set(
			KEY.installation + p.id,
			installationPartView(world, p, focus, coarse),
			p.anchor.cellId
		);
}

function plantingChanged(before: World, after: World) {
	const a = before.state,
		b = after.state;
	return (
		before.grid !== after.grid ||
		a.city !== b.city ||
		a.stacks !== b.stacks ||
		a.cover !== b.cover ||
		a.parts !== b.parts ||
		a.lines !== b.lines ||
		a.spongeWorks !== b.spongeWorks
	);
}

function projectCentres(
	structures: Target['structures'],
	before: World,
	after: World,
	focus: FocusId,
	refocus: boolean
) {
	if (
		refocus ||
		before.grid !== after.grid ||
		before.lines !== after.lines ||
		before.state.city !== after.state.city
	)
		structures.set('city-centres', cityCentreView(after, focus));
	if ((before.state.city || after.state.city) && (refocus || plantingChanged(before, after))) {
		const crowns = bankPlanting(after).map(plantingSurface);
		structures.set('forest:town-banks', present(crowns, focuses[focus].forest));
	}
}

function projectLines(
	structures: Target['structures'],
	world: World,
	delta: ReturnType<typeof changes>,
	focus: FocusId,
	refocus: boolean
) {
	for (const id of delta.removedLines) structures.set(KEY.line + id, []);
	for (const line of refocus ? world.lines : delta.addedLines) {
		structures.set(
			KEY.line + line.id,
			present(roundedStops(lineParts(line, cityTransitSlots)), focuses[focus].rail)
		);
	}
}

function projectSpongeWorks(target: Target, before: World, after: World, redraw: boolean) {
	const prior = before.state.spongeWorks;
	const next = after.state.spongeWorks;
	if (prior === next && !redraw) return;
	const beforeByCell = new Map(prior?.map((work) => [work.cellId, work]));
	const afterByCell = new Map(next?.map((work) => [work.cellId, work]));
	for (const cellId of beforeByCell.keys())
		if (!afterByCell.has(cellId)) target.structures.set(KEY.sponge + cellId, []);
	for (const [cellId, work] of afterByCell)
		if (redraw || beforeByCell.get(cellId) !== work)
			target.structures.set(KEY.sponge + cellId, spongeWorkView(after.grid, work), cellId);
}
function projectAlleys(
	target: Target,
	world: World,
	delta: ReturnType<typeof changes>,
	refocus: boolean
) {
	if (refocus || delta.terrain || delta.houseChunks.size)
		target.terrain.setAlleys(world.grid, world.state.stacks.keys());
}
const houseLayers = new WeakMap<TerrainMesh, ReturnType<typeof houseDistricts>>();

function writeDistrict(
	structures: Target['structures'],
	chunk: string,
	parts: Parameters<Structures['set']>[1],
	visual = false
) {
	const key = (visual ? 'visual:stock-overview:' : KEY.house) + chunk;
	structures.set(key, parts);
}

/** Combines seated model hits with the detached source stock hidden by the town simplification. */
export function housePickTargets(mesh: TerrainMesh, structures: Structures) {
	const stock = houseLayers.get(mesh)?.stockTargets(structures.stockTargets) ?? [];
	return [...structures.solids(KEY.house), ...stock];
}

/** Changes only the render representation of occupied historic lots at the town threshold. */
export function projectStockOverview(
	mesh: TerrainMesh | undefined,
	structures: Target['structures'],
	overview: boolean
) {
	const houses = mesh && houseLayers.get(mesh);
	houses?.setOverview(overview);
	houses?.flush((chunk, parts, visual) => writeDistrict(structures, chunk, parts, visual));
}

function projectHouses(
	target: Target,
	world: World,
	delta: ReturnType<typeof changes>,
	focus: FocusId,
	refocus: boolean
) {
	const houses = houseLayers.get(target.terrain) ?? houseDistricts();
	houseLayers.set(target.terrain, houses);
	if (refocus) houses.reset();
	const keys = new Set(delta.houseGroups.keys());
	const chunks = refocus ? world.grid.chunks.keys() : delta.houseChunks;
	for (const chunk of chunks) {
		const groups = houseGroups(
			world,
			chunk,
			focuses[focus],
			refocus ? undefined : keys,
			target.earliestFullYear
		);
		for (const [key, parts] of groups) {
			houses.set(chunk, key, parts);
			target.openingGroups?.set(key, parts);
			keys.delete(key);
		}
	}
	for (const removed of keys) houses.remove(removed);
	houses.flush((chunk, parts, visual) => writeDistrict(target.structures, chunk, parts, visual));
}

/**
 * Redraws what differs between two worlds of the same seed: the terrain surface if the grid
 * moved, and only the touched house and forest chunks, cover cells and lines.
 */
export function projectChanges(
	target: Target,
	before: World,
	after: World,
	focus: FocusId,
	refocus: boolean
) {
	const { structures } = target;
	const { grid, state, seed } = after;
	const delta = changes(before, after);
	if (delta.terrain) target.terrain.setGrid(grid);
	if (after.lines !== before.lines)
		target.terrain.setPiers(
			grid,
			after.lines.flatMap((line) =>
				line.pillars.map((p) => ({
					foot: p.foot,
					radius: line.profile?.supportRadius ?? TRANSIT_PARAMS[line.kind].supportRadius.default
				}))
			)
		);
	const levels = focuses[focus];
	target.terrain.setPresentation(levels, focus === 'people');
	projectAlleys(target, after, delta, refocus);
	const chunks = (dirty: ReadonlySet<string>) => (refocus ? grid.chunks.keys() : dirty);
	projectHouses(target, after, delta, focus, refocus);
	for (const chunk of chunks(delta.forestChunks))
		structures.set(
			KEY.forest + chunk,
			present(forestChunk(grid, state.cover, chunk, seed).map(plantingSurface), levels.forest)
		);

	if (refocus || delta.installations)
		projectInstallations(structures, before, after, focus, target.coarse);
	projectSpongeWorks(target, before, after, refocus || delta.terrain);
	projectCentres(structures, before, after, focus, refocus);
	projectCover(target, after, delta.coverCells);
	projectLines(structures, after, delta, focus, refocus);
}
