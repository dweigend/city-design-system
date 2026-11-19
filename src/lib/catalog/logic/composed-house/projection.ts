import { houseStructure } from './structure';
import { registryElements } from './provider';
import { houseSurfaces } from './surfaces';
import type { Section } from './types';
/** Projects the frame and fits the selected assets with caller-supplied slot assignments. */
export function sectionParts(section: Section, surfaces = houseSurfaces) {
	return [
		...houseStructure(section, surfaces),
		...section.slots.flatMap((slot) => registryElements(slot, section.seed, surfaces))
	];
}
