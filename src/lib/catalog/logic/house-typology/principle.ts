import { hashUnit } from '../../core/random';
import {
	exoskeletonHouse,
	fannedTrussHouse,
	mastHouse,
	tentMastHouse,
	type HouseStructure,
	type Plot,
	type Walk
} from '../house-structure';

/** Share of eligible houses that keep their layers. */
const LAYERED_SHARE = 0.5;
/** Clear height from the highest deck to a lantern head, metres. */
const HEADROOM = 2.6;
/** Height of a mast head or of a twisted crown above that clearance, metres. */
const CROWN_RISE = 2.4;
/** Height of a tent mast's tip above its lookout, metres. */
const TENT_RISE = 8;

type Site = Pick<
	import('./survey').Survey,
	'id' | 'seed' | 'cells' | 'programme' | 'requestedSystem'
>;

/**
 * The house an ensemble of several houses names as its cloth figure: the member below the high
 * point with the lowest stateless draw of the ensemble seed and its id. Undefined for a single
 * house or when every member is a high point.
 */
export function ensembleFigure(houses: ReadonlyMap<string, { role: string }>, seed: number) {
	if (houses.size < 2) return undefined;
	const draw = (id: string) => hashUnit(seed, id, 'ensemble/figure');
	return [...houses]
		.filter(([, house]) => house.role !== 'high')
		.map(([id]) => id)
		.sort((a, b) => draw(a) - draw(b) || a.localeCompare(b))[0];
}

/**
 * Chooses how a house carries itself. A house on one convex cell with two to six storeys may
 * be a tent mast, a calyx mast, a twisted fanned truss or a cushion exoskeleton. A house stays
 * layered for a requested shell system, when a neighbour shares part of a face (`joined`) or when it is the high point of an
 * ensemble (`anchor`), whose upper body carries the ensemble's accent. The ensemble's `figure`
 * is always a tent mast when it is eligible, so a court shows one large cloth form. Every other
 * draw is a stateless hash of the house seed and id.
 */
export function housePrinciple(site: Site, joined: boolean, anchor: boolean, figure = false) {
	const storeys = site.programme.length;
	if (site.requestedSystem || joined || anchor) return 'layers';
	if (site.cells.length !== 1 || storeys < 2 || storeys > 6) return 'layers';
	if (figure) return 'tent-mast';
	const draw = hashUnit(site.seed, site.id, 'house/principle');
	if (draw < LAYERED_SHARE) return 'layers';
	const share = (draw - LAYERED_SHARE) / (1 - LAYERED_SHARE);
	if (share < 0.35) return 'tent-mast';
	if (share < 0.55) return 'mast';
	return share < 0.8 ? 'fanned-truss' : 'exoskeleton';
}

/**
 * Builds the structure of a non-layered house from the datums its storeys would occupy, world
 * heights ascending with the roof datum last. A tent mast keeps only the roof datum as its
 * lookout; the other principles put a platform on every datum. Cloth that reaches the ground
 * lifts its hem over `walk`, the ground walk from the stair foot out to the parcel face.
 */
export function framedStructure(
	principle: Exclude<ReturnType<typeof housePrinciple>, 'layers'>,
	plot: Plot,
	datums: number[],
	walk: Walk
): HouseStructure {
	const levels = datums.map((z) => z - plot.ground);
	const top = levels[levels.length - 1],
		clear = top + HEADROOM;
	if (principle === 'tent-mast')
		return tentMastHouse(plot, { lookout: top, height: top + TENT_RISE, walk });
	if (principle === 'mast')
		return mastHouse(plot, { datums: levels, height: clear + CROWN_RISE, walk });
	if (principle === 'fanned-truss')
		return fannedTrussHouse(plot, { datums: levels, height: clear + CROWN_RISE, walk });
	return exoskeletonHouse(plot, { datums: levels, height: clear, walk });
}
