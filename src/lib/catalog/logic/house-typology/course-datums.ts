import { hashUnit } from '../../core/random';
import { STORY } from '../../data/grid';
import type { Plan } from './types';

/** Places a course on the common podium and gallery grid or the private upper section. */
export function courseDatum(ground: number, id: string, seed: number, i: number, gallery?: number) {
	if (!i) return ground;
	const nominal = ground + i * STORY;
	const address = i <= 2 || i === gallery ? 'shared' : id;
	return nominal + 1.5 * (hashUnit(seed, 'section/datum', address, nominal) - 0.5);
}
/** Places doors, ceilings and the crown on the same surveyed vertical section in metres. */
export function courseDatums(plan: Plan, ensembleSeed: number, gallery?: number) {
	const { ground, programme, id } = plan.site;
	return Array.from({ length: programme.length + 1 }, (_, i) =>
		courseDatum(ground, id, ensembleSeed, i, gallery)
	);
}

/** Keeps the common ceiling and upper gallery level while seating the first floor on the finished approach. */
export function groundCourse(site: Plan['site'], ceiling: number) {
	const floor = site.finishedFloor;
	// Where the cut would consume the first room, retain the planned entrance and its access flight.
	if (floor === undefined || !Number.isFinite(floor) || floor > ceiling - 2.1) {
		// The parcel pad is the walking surface of storey zero. Seat its slab below it.
		const slab = 0.6;
		return { seat: site.start === 0 ? site.ground - slab : site.ground, slab, surveyed: false };
	}
	return { seat: floor - 0.16, slab: 0.16, surveyed: true };
}
