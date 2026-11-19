import type { HouseSite } from './types';
import type { HouseSurfaces } from './surfaces';
import { planHouse } from './section';
import { sectionParts } from './projection';
export { houseSurfaces, type HouseSurfaces } from './surfaces';
export { planHouse, sectionParts };
export type { HouseSite } from './types';
export { houseLinks } from './links';

/** Builds one connected painted footprint as ordered world-metre primitives. */
export function composedHouse(site: HouseSite, surfaces?: HouseSurfaces) {
	return sectionParts(planHouse(site), surfaces);
}

export { composedGroups, paintedSections, sectionGroups } from './groups';

export type { HouseObstacle } from './clearance';
