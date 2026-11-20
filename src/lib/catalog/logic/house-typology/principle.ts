import { hashUnit } from '../../core/random';
import {
	exoskeletonHouse,
	fannedTrussHouse,
	mastHouse,
	tentMastHouse,
	type HouseStructure,
	type Plot
} from '../house-structure';

/** Share of eligible houses that keep their layers. */
const LAYERED_SHARE = 0.5;
/** Clear height from the highest deck to a brim or fan hub, metres. */
const HEADROOM = 2.6;
/** Height of a mast head or of fan tips above that clearance, metres. */
const CROWN_RISE = 2.4;
/** Height of a tent mast's tip above its lookout, metres. */
const TENT_RISE = 8;

type Site = { id: string; seed: number; cells: readonly unknown[]; programme: unknown[] };

/**
 * Chooses how a house carries itself. A house on one convex cell with two to six storeys may
 * be a tent mast, a brim mast, a fanned truss or an exoskeleton. A house stays layered when a
 * neighbour hides one of its faces (`joined`) or when it is the high point of an ensemble
 * (`anchor`), whose upper body carries the ensemble's accent. The draw is a stateless hash of
 * the house seed and id.
 */
export function housePrinciple(site: Site, joined: boolean, anchor: boolean) {
	const storeys = site.programme.length;
	if (joined || anchor) return 'layers';
	if (site.cells.length !== 1 || storeys < 2 || storeys > 6) return 'layers';
	const draw = hashUnit(site.seed, site.id, 'house/principle');
	if (draw < LAYERED_SHARE) return 'layers';
	const share = (draw - LAYERED_SHARE) / (1 - LAYERED_SHARE);
	if (share < 0.35) return 'tent-mast';
	if (share < 0.55) return 'mast';
	return share < 0.8 ? 'fanned-truss' : 'exoskeleton';
}

/** Index of the ring edge whose midpoint lies nearest to a plan point. */
function nearestEdge(ring: [number, number][], [x, y]: [number, number]) {
	const distance = (i: number) => {
		const a = ring[i],
			b = ring[(i + 1) % ring.length];
		return Math.hypot((a[0] + b[0]) / 2 - x, (a[1] + b[1]) / 2 - y);
	};
	return ring.reduce((best, _, i) => (distance(i) < distance(best) ? i : best), 0);
}

/**
 * Builds the structure of a non-layered house from the datums its storeys would occupy, world
 * heights ascending with the roof datum last. A tent mast keeps only the roof datum as its
 * lookout and opens towards `entrance`; the other principles put a platform on every datum.
 */
export function framedStructure(
	principle: Exclude<ReturnType<typeof housePrinciple>, 'layers'>,
	plot: Plot,
	datums: number[],
	entrance: [number, number]
): HouseStructure {
	const levels = datums.map((z) => z - plot.ground);
	const top = levels[levels.length - 1],
		clear = top + HEADROOM;
	if (principle === 'tent-mast')
		return tentMastHouse(plot, {
			lookout: top,
			height: top + TENT_RISE,
			open: nearestEdge(plot.parcel.polygon, entrance)
		});
	if (principle === 'mast') return mastHouse(plot, { datums: levels, height: clear + CROWN_RISE });
	if (principle === 'fanned-truss')
		return fannedTrussHouse(plot, { datums: levels, height: clear + CROWN_RISE });
	return exoskeletonHouse(plot, { datums: levels, height: clear });
}
