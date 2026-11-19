import { changedSpans } from './composed-projection';
import { affectedHouseGroups } from './houses';
import { changedChunks, neighborsOf } from '../quad-grid';
import type { World } from './world';

/** What a view has to redraw to get from one world to another. */
export type Changes = Readonly<{
	/** True if the grid moved: the terrain surface has to be drawn again. */
	terrain: boolean;
	installations: boolean;
	houseChunks: ReadonlySet<string>;
	houseGroups: ReadonlyMap<string, string>;
	forestChunks: ReadonlySet<string>;
	/** Cells whose cover differs. */
	coverCells: readonly string[];
	removedLines: readonly string[];
	addedLines: World['lines'];
}>;

/** Keys whose values differ between two maps, by reference. */
function changedKeys<V>(before: ReadonlyMap<string, V>, after: ReadonlyMap<string, V>): string[] {
	const keys: string[] = [];
	for (const [key, value] of after) if (before.get(key) !== value) keys.push(key);
	for (const key of before.keys()) if (!after.has(key)) keys.push(key);
	return keys;
}

function editedCells(before: World, after: World) {
	if (before.state.year !== after.state.year || before.roofBuilder !== after.roofBuilder)
		return [...new Set([...before.state.stacks.keys(), ...after.state.stacks.keys()])];
	return [
		...new Set([
			...changedKeys(before.state.stacks, after.state.stacks),
			...changedKeys(before.state.storyParts, after.state.storyParts)
		])
	];
}

function movedCells(before: World, after: World, chunks: ReadonlySet<string>) {
	const ids: string[] = [];
	for (const chunk of chunks) {
		for (const cell of after.grid.chunks.get(chunk) ?? []) {
			if (before.grid.cellsById.get(cell.id) !== cell) ids.push(cell.id);
		}
	}
	return ids;
}

function changedHouses(before: World, after: World, moved: ReadonlySet<string>) {
	const ids = new Set([...editedCells(before, after), ...movedCells(before, after, moved)]);
	if (!ids.size) return new Map<string, string>();
	return new Map([
		...affectedHouseGroups(before, ids),
		...affectedHouseGroups(after, ids),
		...changedSpans(before, after)
	]);
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
	const houseGroups = changedHouses(before, after, moved);
	// Lines compare by reference: a re-routed line keeps its id but is a new route.
	const beforeLines = new Set(before.lines);
	const afterLines = new Set(after.lines);
	return {
		terrain: moved.size > 0,
		installations: before.grid !== after.grid || before.state.parts !== after.state.parts,
		houseChunks: new Set(houseGroups.values()),
		houseGroups,
		forestChunks: new Set([...forestChunks(before, after, coverCells), ...moved]),
		coverCells,
		removedLines: before.lines.filter((line) => !afterLines.has(line)).map((line) => line.id),
		addedLines: after.lines.filter((line) => !beforeLines.has(line))
	};
}
