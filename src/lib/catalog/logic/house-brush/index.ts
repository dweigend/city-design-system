/**
 * House brush: the player paints stories onto grid cells, the grammar derives architecture.
 * The grammar reads only the quad carrier contract, so it works on every grid of quads.
 * Public entry point of the module; everything else in this folder is private.
 *
 * State is a plain map of stacks; derived geometry is a pure function of stacks, grid and
 * seed per chunk, so a local edit rebuilds only the chunks it touches and yields the same
 * result as a full rebuild (PD-10).
 */
import type { Primitive } from '../parametrik/types';
import type { QuadCell, QuadGrid } from '../quad-grid';
import { body } from './body';
import { profileOf } from './profile';
import { crowns } from './crowns';
import { floorOf, massesOfChunk } from './massing';
import { storiesOf, type Stacks } from './stacks';

export { MAX_STORIES, lower, raise, storiesOf, type HouseUse, type Stacks } from './stacks';
export { chunksOfCells, touchedChunks } from './massing';

/**
 * All parts of the masses anchored in one chunk, in the shared render contract.
 * @param chunk chunk identity of the grid's cells
 * @param seed integer seed of the decor decisions (openings, crowns)
 * @returns detached primitives in world meters; empty for a chunk without masses
 */
export function houseChunk(
	grid: QuadGrid,
	stacks: Stacks,
	chunk: string,
	seed: number
): Primitive[] {
	const site = { grid, stacks, seed };
	return massesOfChunk(grid, stacks, chunk).flatMap((mass) => {
		const profile = profileOf(site, mass);
		return [...body(site, mass, profile), ...crowns(site, mass, profile.tiers * profile.rise)];
	});
}

/** Height in meters of the top of a cell's stack: where the next story would stand. */
export const stackTop = (stacks: Stacks, cell: QuadCell): number =>
	floorOf(cell, storiesOf(stacks, cell.id).length);
