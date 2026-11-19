import { STORY } from '../../data/grid';
import type { Point2 } from '../parametrik/vocab';
import type { Site } from './form';
import { floorOf, massStoreys, type Mass, type Story } from './massing';
import { insetRing, insetSides, type boundaryRuns } from './outline';
import { storiesOf } from './stacks';

const PLINTH_OVERHANG_M = 0.3;
const JOINT_HALF_WIDTH_M = 0.04;
const CROWN_INSET_M = 0.3;

type Run = ReturnType<typeof boundaryRuns>[number];

/** Ground storey of a joined body, modeled with a wider paper wall. */
export const isPlinth = (mass: Mass) => mass.volume?.form === 'sockel';

function facesBody(site: Site, mass: Mass, neighborId: string) {
	const neighbor = site.grid.cellsById.get(neighborId);
	if (!neighbor || !site.ensembles?.cells.has(neighborId)) return false;
	return storiesOf(site.stacks, neighborId).some((_, level) => {
		const floor = floorOf(neighbor, level);
		return floor < mass.floor + massStoreys(mass) * STORY && floor + STORY > mass.floor;
	});
}

/** Wall inset from a plot side, in meters, with half a joint at adjoining bodies. */
export function wallMargin(site: Site, mass: Mass, story: Story, side: number, inset: number) {
	const { cell } = story;
	const placed = site.ensembles?.cells.get(cell.id);
	if (!placed?.neighbors.length) return inset;
	const neighborId = cell.neighbors[side];
	if (neighborId && facesBody(site, mass, neighborId)) return JOINT_HALF_WIDTH_M;
	if (isPlinth(mass)) return inset - PLINTH_OVERHANG_M;
	const crown = mass.volume?.form === 'turm' ? CROWN_INSET_M : 0;
	const setback =
		placed.front === side
			? Math.max(
					...mass.stories.map(({ cell }) => site.ensembles?.cells.get(cell.id)?.setback ?? 0)
				)
			: 0;
	return inset + crown + setback;
}

/** Inset ring of a joined wall. Unpainted outlines keep their existing uniform profile. */
export function wallRing(site: Site, mass: Mass, run: Run, inset: number) {
	const ring = run.map(({ from: [x, y] }): Point2 => [x, y]);
	const stories = new Map(mass.stories.map((story) => [story.cell.id, story]));
	const margins = run.map(({ cellId, index }) => {
		const story = stories.get(cellId);
		return story ? wallMargin(site, mass, story, index, inset) : inset;
	});
	return margins.every((margin) => margin === inset)
		? insetRing(ring, inset)
		: insetSides(ring, margins);
}
