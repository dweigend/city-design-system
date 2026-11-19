import type { HouseSite, ElementProvider } from './types';
import { planHouse } from './section';
import { sectionParts } from './projection';
import { placeholderElements } from './provider';
export { planHouse, placeholderElements, sectionParts };
export type { HouseSite, Section, HouseSlot, ElementProvider } from './types';
export { houseLinks } from './links';

/** Builds one connected painted footprint as ordered world-metre primitives. */
export function composedHouse(site: HouseSite, provide?: ElementProvider) {
	return sectionParts(planHouse(site), provide);
}

export { composedGroups, paintedSections, sectionGroups } from './groups';

export type { HouseObstacle } from './clearance';
