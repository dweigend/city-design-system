import { person } from './people';
import { houseStructure } from './structure';
import { bodyParts } from './provider';
import { houseSurfaces } from './surfaces';
import type { Section } from './types';
import type { HouseUse } from '../../data/house-body';
import type { HouseSurfaces } from './surfaces';
import { servicePipes } from './service-pipes';
import { access } from './access';

function programmePalette(section: Section, surfaces: HouseSurfaces) {
	const counts = new Map<HouseUse, number>();
	for (const b of section.slots) counts.set(b.use, (counts.get(b.use) ?? 0) + 1);
	const sorted = [...counts].sort((a, b) => b[1] - a[1]);
	const limited = { ...surfaces };
	for (const [use] of sorted.slice(3)) limited[use] = surfaces.shell;
	return limited;
}
/** Projects the same surveyed assembly in the bible and the sandbox. */
export function sectionParts(section: Section, surfaces = houseSurfaces) {
	const palette = programmePalette(section, surfaces);
	return [
		...houseStructure(section, surfaces),
		...section.slots.flatMap((b) => bodyParts(b, palette)),
		...servicePipes(section, palette),
		...access(section, surfaces),
		...section.composition.people.flatMap((p, i) =>
			person(p.position, section.id + '/people/' + i, section.seed, surfaces)
		)
	];
}
