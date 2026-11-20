export { planPoints as housePartPlan } from './part-plan';
export { circulation } from './circulation';
import type { HouseSite } from './types';
import type { HouseSurfaces } from '../material/house-surfaces';
import { planHouse } from './section';
import { accentBody, accentKind, ensembleAnchor } from './accent';
import { sectionParts } from './projection';
export { houseSurfaces, type HouseSurfaces } from '../material/house-surfaces';
export { accentBody, accentKind, ensembleAnchor, planHouse, sectionParts };
export type { HouseSite } from './types';
export { houseLinks } from './links';
export { structureHouse } from './structure-house';

/** Builds one connected painted footprint as ordered world-metre primitives. */
export function composedHouse(site: HouseSite, surfaces?: HouseSurfaces) {
	return sectionParts(planHouse(site), surfaces);
}

export { composedGroups, paintedSections, sectionGroups } from './groups';

export type { HouseObstacle } from './clearance';
export { person } from './people';
