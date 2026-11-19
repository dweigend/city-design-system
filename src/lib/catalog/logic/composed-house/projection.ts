import { houseStructure } from './structure';
import { registryElements } from './provider';
import { houseSurfaces } from './surfaces';
import type { ElementProvider, Section } from './types';
/** Projects the frame and fits the selected assets with caller-supplied slot assignments. */
export function sectionParts(
	section: Section,
	provide?: ElementProvider,
	surfaces = houseSurfaces
) {
	return [
		...houseStructure(section, surfaces),
		...section.slots.flatMap((slot) =>
			provide ? provide(slot) : registryElements(slot, section.seed, surfaces)
		)
	];
}
