import { perimeterHouse } from './perimeter';
import { layout } from './layout';
import type { HouseSite } from './site';
import { planEnsemble, type EnsembleContext } from './ensemble';
import { survey } from './survey';
import type { HouseComposition } from './types';

/** Derives the occupied courses and continuous exterior from the surveyed parcel. */
export function composeHouse(
	input: HouseSite,
	context: EnsembleContext = planEnsemble([input])
): HouseComposition {
	const site = survey(input);
	const { plan, role, accessSide } = layout(site, context);
	return perimeterHouse(plan, role, accessSide, context);
}
