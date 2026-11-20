export { planPoints as housePartPlan } from './part-plan';
export { circulation } from './circulation';
import type { HouseSite } from './types';
import type { HouseSurfaces } from './surfaces';
import { planHouse } from './section';
import { accentBody, ensembleAnchor } from './accent';
import { sectionParts } from './projection';
export { houseSurfaces, type HouseSurfaces } from './surfaces';
export { accentBody, ensembleAnchor, planHouse, sectionParts };
export type { HouseSite } from './types';
export { houseLinks } from './links';

/** Builds one connected painted footprint as ordered world-metre primitives. */
export function composedHouse(site: HouseSite, surfaces?: HouseSurfaces) {
	return sectionParts(planHouse(site), surfaces);
}

export { composedGroups, paintedSections, sectionGroups } from './groups';

export type { HouseObstacle } from './clearance';
export { person } from './people';
