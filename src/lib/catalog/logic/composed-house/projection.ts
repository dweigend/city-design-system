import { person } from './people';
import { houseStructure } from './structure';
import { bodyParts } from './provider';
import { houseSurfaces } from './surfaces';
import type { Section } from './types';
import { access } from './access';

/** Projects the same surveyed assembly in the bible and the sandbox. */
export function sectionParts(section: Section, surfaces = houseSurfaces) {
	return [...houseStructure(section,surfaces), ...section.slots.flatMap(b => bodyParts(b,surfaces)), ...access(section,surfaces), ...section.composition.people.flatMap((p,i)=>person(p.position,section.id+'/people/'+i,section.seed,surfaces))];
}
