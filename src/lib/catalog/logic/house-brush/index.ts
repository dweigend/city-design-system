import { composedGroups } from '../composed-house';
import { totemMass } from './style-totem';
import { megastructureMass } from './style-megastructure';
import { roofCarrier, type RoofContext } from './roof-carrier';
import { stackPrintOrder } from './print-contact';
import type { Site } from './form';
import { profileOf } from './profile';
import type { RoofBuilder } from '../building-envelope';
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

import { massAt, floorOf, massesOfChunk, type Mass } from './massing';
import { storiesOf, type Stacks } from './stacks';
import { massRules, type HouseStyle } from './styles';

export { MAX_STORIES, lower, raise, storiesOf, type HouseUse, type Stacks } from './stacks';
export { touchedChunks } from './massing';

export { castingSeed } from './ceramic-fitting';
export { shellForms } from './style-totem';
export { HOUSE_STYLES, type HouseStyle } from './styles';

/**
 * All parts of the masses anchored in one chunk, in the shared render contract.
 * @param chunk chunk identity of the grid's cells
 * @param seed integer seed of the decor decisions (openings, crowns)
 * @param style look of the masses; the massing itself is the same in every style
 * @param context optional full occupancy and historic roof frontage of a layered town
 * @param roofBuilder preloaded geometry roofBuilder for historic roofs
 * @returns detached primitives in world meters; empty for a chunk without masses
 */
export function houseChunk(
	grid: QuadGrid,
	stacks: Stacks,
	chunk: string,
	seed: number,
	style: HouseStyle = 'terrace',
	context?: RoofContext,
	roofBuilder?: RoofBuilder
): Primitive[] {
	if (style === 'composed')
		return composedGroups(grid, stacks, seed)
			.filter((g) => g.chunk === chunk)
			.flatMap((g) => g.parts());
	const site = massSite(grid, stacks, seed, style, context, roofBuilder);
	const parts = massesOfChunk(grid, stacks, chunk, wallEnsembles(style, context)).flatMap((mass) =>
		massParts(site, mass, style, context)
	);
	return site.printOrder
		? parts.filter((p) => !p.overprint).concat(parts.filter((p) => p.overprint))
		: parts;
}

/** Continuous wall volumes use the body grammar of the painted wall styles. */
export function wallEnsembles(style: HouseStyle, context?: Pick<RoofContext, 'ensembles'>) {
	return style === 'collage' || style === 'terrace' ? context?.ensembles : undefined;
}

function massSite(
	grid: QuadGrid,
	stacks: Stacks,
	seed: number,
	style: HouseStyle,
	context?: RoofContext,
	roofBuilder?: RoofBuilder
): Site {
	return {
		grid,
		stacks: context?.occupied ?? stacks,
		seed,
		roofBuilder,
		ensembles: wallEnsembles(style, context),
		printOrder: style === 'collage' ? (context?.printOrder ?? stackPrintOrder(stacks)) : undefined
	};
}

/** Derives the detached world-meter geometry of one identified mass, retaining its part order. */
export function houseMassParts(
	grid: QuadGrid,
	stacks: Stacks,
	mass: Mass,
	seed: number,
	style: HouseStyle,
	context?: RoofContext,
	roofBuilder?: RoofBuilder
): Primitive[] {
	if (style === 'composed') {
		const anchors = new Set(
			mass.stories
				.filter(({ cell, level }) => level === stacks.get(cell.id)?.findIndex(Boolean))
				.map(({ cell }) => cell.id)
		);
		return composedGroups(grid, stacks, seed)
			.filter((g) => anchors.has(g.cells[0]))
			.flatMap((g) => g.parts());
	}
	return massParts(massSite(grid, stacks, seed, style, context, roofBuilder), mass, style, context);
}

function massParts(
	site: Site,
	mass: Mass,
	style: Exclude<HouseStyle, 'composed'>,
	context?: RoofContext
): Primitive[] {
	// Q installations carry their own parts; older story records still use the saved house grammar.
	if (context && (style === 'megastructure' || style === 'totem')) {
		const rule = style === 'totem' ? totemMass : megastructureMass;
		return [...rule(site, mass), ...roofCarrier(site, mass, context)];
	}
	return massRules[style](site, mass);
}

export { massAt, massesOfChunk, type Mass };
export { massStoryKeys } from './massing';

/** Height in meters of the top of a cell's stack: where the next story would stand. */
export const stackTop = (stacks: Stacks, cell: QuadCell): number =>
	floorOf(cell, storiesOf(stacks, cell.id).length);

export {
	atSocket,
	socketBounds,
	capsulePitch,
	moduleGroup,
	type SocketFit,
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
export { boundaryRings, insetRing, ringArea } from './outline';
export { planEnsembles, type Ensembles, type EnsembleCell } from './ensemble';
