import { roofCarrier, type RoofContext } from './roof-carrier';
import { totemMass } from './style-totem';
import { megastructureMass } from './style-megastructure';
import { profileOf } from './profile';
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

import { massAt, floorOf, massesOfChunk } from './massing';
import { storiesOf, type Stacks } from './stacks';
import { massRules, type HouseStyle } from './styles';

export { MAX_STORIES, lower, raise, storiesOf, type HouseUse, type Stacks } from './stacks';
export { chunksOfCells, touchedChunks } from './massing';

export { shellForms } from './style-totem';
export { HOUSE_STYLES, type HouseStyle } from './styles';

/**
 * All parts of the masses anchored in one chunk, in the shared render contract.
 * @param chunk chunk identity of the grid's cells
 * @param seed integer seed of the decor decisions (openings, crowns)
 * @param style look of the masses; the massing itself is the same in every style
 * @param context optional full occupancy and historic roof frontage of a layered town
 * @returns detached primitives in world meters; empty for a chunk without masses
 */
export function houseChunk(
	grid: QuadGrid,
	stacks: Stacks,
	chunk: string,
	seed: number,
	style: HouseStyle = 'terrace',
	context?: RoofContext
): Primitive[] {
	const site = { grid, stacks: context?.occupied ?? stacks, seed };
	// Old story records retain the grammar that built them. Q installations carry their own parts.
	if (context && (style === 'megastructure' || style === 'totem')) {
		const rule = style === 'totem' ? totemMass : megastructureMass;
		return massesOfChunk(grid, stacks, chunk).flatMap((mass) => [
			...rule(site, mass),
			...roofCarrier(site, mass, context)
		]);
	}
	const rule = massRules[style];
	return massesOfChunk(grid, stacks, chunk).flatMap((mass) => rule(site, mass));
}

/** Height in meters of the top of a cell's stack: where the next story would stand. */
export const stackTop = (stacks: Stacks, cell: QuadCell): number =>
	floorOf(cell, storiesOf(stacks, cell.id).length);

export {
	atSocket,
	socketBounds,
	capsulePitch,
	moduleGroup,
	type ModuleRecipe
} from './module-group';
export { carrierForm } from './style-megastructure';

/** Actual wall setback and exposed faces of the roof story on a building plot. */
export function roofWalls(grid: QuadGrid, stacks: Stacks, cell: QuadCell, seed: number) {
	const level = storiesOf(stacks, cell.id).length - 1;
	const mass = massAt(grid, stacks, cell, level);
	const members = new Set(mass.stories.map((s) => s.cell.id));
	const inset = profileOf({ grid, stacks, seed }, mass).wallInset;
	return { inset, exposed: cell.neighbors.map((n) => !n || !members.has(n)) };
}
export { boundaryRings, ringArea } from './outline';
