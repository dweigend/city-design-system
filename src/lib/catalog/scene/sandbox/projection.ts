/**
 * Projection of sandbox worlds onto the stage: derives the parts that differ between two
 * worlds and hands them to the terrain and the structure layer. Nothing flows back (PP-2).
 */
import { focuses, present, levelFor, type FocusId } from '../../logic/presentation';
import { forestChunk } from '../../logic/land-cover';
import {
	installationPartView,
	houseView,
	currentStacks,
	changes,
	type World
} from '../../logic/sandbox';
import { lineParts } from '../../logic/transit-line';
import type { Structures } from './structures';
import type { TerrainMesh } from './terrain-mesh';

/** Keys of the structure layer per kind of derived part. */
export const KEY = {
	house: 'house:',
	forest: 'forest:',
	line: 'line:',
	installation: 'installation:'
};

export type Target = Readonly<{
	terrain: TerrainMesh;
	structures: Pick<Structures, 'set'>;
	earliestFullYear?: number;
	coarse?: boolean;
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

function projectLines(
	structures: Target['structures'],
	world: World,
	delta: ReturnType<typeof changes>,
	focus: FocusId,
	refocus: boolean
) {
	for (const id of delta.removedLines) structures.set(KEY.line + id, []);
	for (const line of refocus ? world.lines : delta.addedLines) {
		const level = levelFor(focus, 'rail', line.year, world.state.year);
		structures.set(KEY.line + line.id, present(lineParts(line), level));
	}
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
	const levels = focuses[focus];
	target.terrain.setPresentation(levels, focus === 'people');
	const stacks = currentStacks(state);
	projectAlleys(target, after, delta, refocus);
	const chunks = (dirty: ReadonlySet<string>) => (refocus ? grid.chunks.keys() : dirty);
	for (const chunk of chunks(delta.houseChunks))
		structures.set(
			KEY.house + chunk,
			houseView(after, stacks, chunk, levels, target.earliestFullYear)
		);
	for (const chunk of chunks(delta.forestChunks))
		structures.set(
			KEY.forest + chunk,
			present(forestChunk(grid, state.cover, chunk, seed), levels.forest)
		);

	if (refocus || delta.installations)
		projectInstallations(structures, before, after, focus, target.coarse);
	projectCover(target, after, delta.coverCells);
	projectLines(structures, after, delta, focus, refocus);
}
