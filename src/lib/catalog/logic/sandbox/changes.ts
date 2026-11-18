import { chunksOfCells, touchedChunks } from '../house-brush';
import { changedChunks, neighborsOf } from '../quad-grid';
import type { TransitLine } from '../transit-line';
import type { World } from './world';

/** What a view has to redraw to get from one world to another. */
export type Changes = Readonly<{
	/** True if the grid moved: the terrain surface has to be drawn again. */
	terrain: boolean;
	houseChunks: ReadonlySet<string>;
	forestChunks: ReadonlySet<string>;
	/** Cells whose cover differs. */
	coverCells: readonly string[];
	removedLines: readonly string[];
	addedLines: readonly TransitLine[];
}>;

/** Keys whose values differ between two maps, by reference. */
function changedKeys<V>(before: ReadonlyMap<string, V>, after: ReadonlyMap<string, V>): string[] {
	const keys: string[] = [];
	for (const [key, value] of after) if (before.get(key) !== value) keys.push(key);
	for (const key of before.keys()) if (!after.has(key)) keys.push(key);
	return keys;
}

function houseChunks(before: World, after: World, movedChunks: ReadonlySet<string>): Set<string> {
	const stackCells = changedKeys(before.state.stacks, after.state.stacks);
	const chunks = new Set<string>();
	for (const world of [before, after]) {
		const { grid } = world;
		for (const chunk of touchedChunks(grid, before.state.stacks, after.state.stacks, stackCells))
			chunks.add(chunk);
		// Houses on cells that moved take the new cell shapes.
		const moved = [...movedChunks].flatMap((chunk) => grid.chunks.get(chunk) ?? []);
		for (const chunk of chunksOfCells(grid, world.state.stacks, moved)) chunks.add(chunk);
	}
	return chunks;
}

function forestChunks(before: World, after: World, coverCells: readonly string[]): Set<string> {
	const chunks = new Set<string>();
	for (const cellId of coverCells) {
		const isForest = [before, after].some((world) => world.state.cover.get(cellId) === 'forest');
		const cell = after.grid.cellsById.get(cellId);
		if (!isForest || !cell) continue;
		// The forest edge thins out: neighbors change with the cell.
		for (const near of [cell, ...neighborsOf(after.grid, cell)]) chunks.add(near.chunk);
	}
	return chunks;
}

/**
 * Difference between two worlds of the same seed, as the smallest set of derived parts to
 * redraw. Cost: linear in the number of cells. Works for any two worlds, so undo and redo
 * use the same path as a brush stroke.
 */
export function changes(before: World, after: World): Changes {
	const moved =
		before.grid === after.grid ? new Set<string>() : changedChunks(before.grid, after.grid);
	const coverCells = changedKeys(before.state.cover, after.state.cover);
	// Lines compare by reference: a re-routed line keeps its id but is a new route.
	const beforeLines = new Set(before.lines);
	const afterLines = new Set(after.lines);
	return {
		terrain: moved.size > 0,
		houseChunks: houseChunks(before, after, moved),
		forestChunks: new Set([...forestChunks(before, after, coverCells), ...moved]),
		coverCells,
		removedLines: before.lines.filter((line) => !afterLines.has(line)).map((line) => line.id),
		addedLines: after.lines.filter((line) => !beforeLines.has(line))
	};
}
