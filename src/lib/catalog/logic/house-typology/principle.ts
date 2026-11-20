import { hashUnit } from '../../core/random';
import {
	exoskeletonHouse,
	fannedTrussHouse,
	mastHouse,
	type HouseStructure,
	type Plot
} from '../house-structure';

/** Share of eligible houses that keep their layers. */
const LAYERED_SHARE = 0.5;
/** Clear height from the highest deck to a brim or fan hub, metres. */
const HEADROOM = 2.6;
/** Height of a mast head or of fan tips above that clearance, metres. */
const CROWN_RISE = 2.4;

type Site = { id: string; seed: number; cells: readonly unknown[]; programme: unknown[] };

/**
 * Chooses how a house carries itself. A house on one convex cell with two to six storeys and
 * no face hidden by a neighbour (`joined` false) may be a mast, a fanned truss or an
 * exoskeleton; every other house stays layered. The draw is a stateless hash of the house seed
 * and id.
 */
export function housePrinciple(site: Site, joined: boolean) {
	const storeys = site.programme.length;
	if (joined || site.cells.length !== 1 || storeys < 2 || storeys > 6) return 'layers';
	const draw = hashUnit(site.seed, site.id, 'house/principle');
	if (draw < LAYERED_SHARE) return 'layers';
	const share = (draw - LAYERED_SHARE) / (1 - LAYERED_SHARE);
	return share < 0.4 ? 'mast' : share < 0.75 ? 'fanned-truss' : 'exoskeleton';
}

/**
 * Builds the structure of a non-layered house on the datums its storeys already occupy, so
 * stairs and bridges meet a platform at every level. `datums` are world heights, ascending.
 */
export function framedStructure(
	principle: Exclude<ReturnType<typeof housePrinciple>, 'layers'>,
	plot: Plot,
	datums: number[]
): HouseStructure {
	const levels = datums.map((z) => z - plot.ground);
	const clear = levels[levels.length - 1] + HEADROOM;
	if (principle === 'mast') return mastHouse(plot, { datums: levels, height: clear + CROWN_RISE });
	if (principle === 'fanned-truss')
		return fannedTrussHouse(plot, { datums: levels, height: clear + CROWN_RISE });
	return exoskeletonHouse(plot, { datums: levels, height: clear });
}
