import type { HouseSite, ElementProvider } from './types';
import type { HouseSurfaces } from './surfaces';
import { planHouse } from './section';
import { sectionParts } from './projection';
export { houseSurfaces, type HouseSurfaces } from './surfaces';
export { planHouse, sectionParts };
export type { HouseSite, Section, HouseSlot, ElementProvider } from './types';
export { houseLinks } from './links';

/** Builds one connected painted footprint as ordered world-metre primitives. */
export function composedHouse(
	site: HouseSite,
	provide?: ElementProvider,
	surfaces?: HouseSurfaces
) {
	return sectionParts(planHouse(site), provide, surfaces);
}

export { composedGroups, paintedSections, sectionGroups } from './groups';

export type { HouseObstacle } from './clearance';
