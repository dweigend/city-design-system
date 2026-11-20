import { hashUnit } from '../../core/random';
import { STORY } from '../../data/grid';
import type { Plan } from './types';

/** Places doors, ceilings and the crown on the same surveyed vertical section in metres. */
export function courseDatums(plan: Plan, ensembleSeed: number, gallery?: number) {
	const { ground, programme, id } = plan.site;
	return Array.from({ length: programme.length + 1 }, (_, i) => {
		if (!i) return ground;
		const nominal = ground + i * STORY;
		// Shared bases and bridge landings receive the same offset from either side of a party wall.
		const address = i <= 2 || i === gallery ? 'shared' : id;
		return nominal + 1.5 * (hashUnit(ensembleSeed, 'section/datum', address, nominal) - 0.5);
	});
}
