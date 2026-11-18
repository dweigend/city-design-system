import { STORY } from '../../data/grid';
import { neighborsOf, type QuadCell, type QuadGrid } from '../quad-grid';
import { storiesOf, type HouseUse, type Stacks } from './stacks';

export type Story = Readonly<{ cell: QuadCell; level: number }>;

/**
 * One building mass: neighboring stories of the same use whose floors lie at the same height.
 * On a slope that happens along the contour, so masses step up the hill like terraces.
 */
export type Mass = Readonly<{
	/** Identity from the anchor: `cellId@level`. */
	id: string;
	use: HouseUse;
	/** Floor height in meters. */
	floor: number;
	/** True if the mass stands on the raised datum of flooding ground. */
	raised: boolean;
	/** Ordered by cell index; the first story is the anchor. */
	stories: readonly Story[];
}>;

type Like = Pick<Mass, 'use' | 'floor' | 'raised'>;

/** Floor height of a story in meters. */
export const floorOf = (cell: QuadCell, level: number) => cell.pad + level * STORY;

/** Level of the story of `cell` that belongs to a mass with this floor and use, or -1. */
function memberLevel(stacks: Stacks, cell: QuadCell, like: Like) {
	if (cell.raised !== like.raised) return -1;
	const level = (like.floor - cell.pad) / STORY;
	if (!Number.isInteger(level) || level < 0) return -1;
	return storiesOf(stacks, cell.id)[level] === like.use ? level : -1;
}

/**
 * The mass that contains story `level` of `cell`. The story must exist.
 * Cost: one flood fill over the mass. Order-independent: stories come sorted by cell index.
 */
function massAt(grid: QuadGrid, stacks: Stacks, cell: QuadCell, level: number): Mass {
	const like: Like = {
		use: storiesOf(stacks, cell.id)[level],
		floor: floorOf(cell, level),
		raised: cell.raised
	};
	const stories: Story[] = [{ cell, level }];
	const seen = new Set([cell.id]);
	for (let i = 0; i < stories.length; i++)
		for (const neighbor of neighborsOf(grid, stories[i].cell)) {
			if (seen.has(neighbor.id)) continue;
			seen.add(neighbor.id);
			const neighborLevel = memberLevel(stacks, neighbor, like);
			if (neighborLevel >= 0) stories.push({ cell: neighbor, level: neighborLevel });
		}
	stories.sort((a, b) => a.cell.index - b.cell.index);
	return { ...like, id: `${stories[0].cell.id}@${stories[0].level}`, stories };
}

/**
 * All masses anchored in a chunk, in anchor order. A mass may reach into other chunks;
 * it belongs to the chunk of its anchor alone.
 */
export function massesOfChunk(grid: QuadGrid, stacks: Stacks, chunk: string): Mass[] {
	const masses: Mass[] = [];
	const done = new Set<string>();
	for (const cell of grid.chunks.get(chunk) ?? [])
		storiesOf(stacks, cell.id).forEach((_, level) => {
			if (done.has(`${cell.id}@${level}`)) return;
			const mass = massAt(grid, stacks, cell, level);
			for (const story of mass.stories) done.add(`${story.cell.id}@${story.level}`);
			if (mass.stories[0].cell.chunk === chunk) masses.push(mass);
		});
	return masses;
}

/**
 * Chunks whose masses differ between two stack states that differ only in `cellIds`.
 * Covers the edited cells and their side neighbors, whose walls and crowns react.
 */
export function touchedChunks(
	grid: QuadGrid,
	before: Stacks,
	after: Stacks,
	cellIds: Iterable<string>
): Set<string> {
	const chunks = new Set<string>();
	const visit = (cell: QuadCell) => {
		for (const stacks of [before, after])
			storiesOf(stacks, cell.id).forEach((_, level) =>
				chunks.add(massAt(grid, stacks, cell, level).stories[0].cell.chunk)
			);
	};
	for (const cellId of cellIds) {
		const cell = grid.cellsById.get(cellId);
		if (!cell) continue;
		visit(cell);
		neighborsOf(grid, cell).forEach(visit);
	}
	return chunks;
}

/**
 * Chunks that hold the anchor of any mass with a story on the given cells. After the grid
 * moved those cells, these are the house chunks to derive again.
 */
export function chunksOfCells(
	grid: QuadGrid,
	stacks: Stacks,
	cells: Iterable<QuadCell>
): Set<string> {
	const chunks = new Set<string>();
	for (const cell of cells)
		storiesOf(stacks, cell.id).forEach((_, level) =>
			chunks.add(massAt(grid, stacks, cell, level).stories[0].cell.chunk)
		);
	return chunks;
}
