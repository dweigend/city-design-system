import { person } from './people';
import { houseStructure } from './structure';
import { bodyParts } from './provider';
import { houseSurfaces } from './surfaces';
import type { Section } from './types';
import type { HouseSurfaces } from './surfaces';
import { servicePipes } from './service-pipes';
import { landingSeats } from './landing-seats';
import { access } from './access';

/** Projects the same surveyed assembly in the bible and the sandbox. */
export function sectionParts(section: Section, surfaces = houseSurfaces) {
	const house = [
		...houseStructure(section, surfaces),
		...section.slots.flatMap((b) => bodyParts(b, surfaces))
	];
	const walk = access(section, surfaces);
	const seats =
		section.compact || section.composition.path === 'spiral'
			? []
			: landingSeats(walk, house, surfaces.deck);
	return [
		...house,
		...seats,
		...servicePipes(section, surfaces),
		...walk,
		...section.composition.people.flatMap((p, i) =>
			person(p.position, section.id + '/people/' + i, section.seed, surfaces)
		)
	];
}
