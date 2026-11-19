import { houseStructure } from './structure';
import { placeholderElements } from './provider';
import type { ElementProvider, Section } from './types';
/** Fills the surveyed asset slots after drawing the continuous structural members. */
export function sectionParts(section: Section, provide: ElementProvider = placeholderElements) {
	return [...houseStructure(section), ...section.slots.flatMap(provide)];
}
