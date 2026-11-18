/**
 * Projection of sandbox worlds onto the stage: derives the parts that differ between two
 * worlds and hands them to the terrain and the structure layer. Nothing flows back (PP-2).
 */
import { houseChunk } from '../../logic/house-brush';
import { forestChunk } from '../../logic/land-cover';
import { changes, type World } from '../../logic/sandbox';
import { lineParts } from '../../logic/transit-line';
import type { Structures } from './structures';
import type { TerrainMesh } from './terrain-mesh';

/** Keys of the structure layer per kind of derived part. */
export const KEY = { house: 'house:', forest: 'forest:', line: 'line:' };

export type Target = Readonly<{ terrain: TerrainMesh; structures: Structures }>;

function projectCover(target: Target, after: World, cellIds: readonly string[]) {
	for (const cellId of cellIds) {
		const cell = after.grid.cellsById.get(cellId);
		if (cell) target.terrain.setCover(cell.index, after.state.cover.get(cellId));
	}
	if (cellIds.length) target.terrain.commitCover();
}

/**
 * Redraws what differs between two worlds of the same seed: the terrain surface if the grid
 * moved, and only the touched house and forest chunks, cover cells and lines.
 */
export function projectChanges(target: Target, before: World, after: World) {
	const { structures } = target;
	const { grid, state, seed } = after;
	const delta = changes(before, after);
	if (delta.terrain) target.terrain.setGrid(grid);
	for (const chunk of delta.houseChunks)
		structures.set(KEY.house + chunk, houseChunk(grid, state.stacks, chunk, seed));
	for (const chunk of delta.forestChunks)
		structures.set(KEY.forest + chunk, forestChunk(grid, state.cover, chunk, seed));
	projectCover(target, after, delta.coverCells);
	for (const id of delta.removedLines) structures.set(KEY.line + id, []);
	for (const line of delta.addedLines) structures.set(KEY.line + line.id, lineParts(line));
}
