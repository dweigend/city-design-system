import { person, landingPeople } from './people';
import { houseStructure } from './structure';
import { bodyParts } from './provider';
import { houseSurfaces } from './surfaces';
import type { Section } from './types';
import { servicePipes } from './service-pipes';
import { landingSeats } from './landing-seats';
import { access } from './access';

function programmeSurfaces(section: Section, palette: typeof houseSurfaces) {
	const counts = new Map<Section['slots'][number]['use'], number>();
	for (const use of section.decks.flatMap((l) => l.programme))
		counts.set(use, (counts.get(use) ?? 0) + 1);
	const leading = [...counts].sort((a, b) => b[1] - a[1])[0][0];
	const paint = palette[leading];
	return {
		...palette,
		access: palette.access === houseSurfaces.access ? paint : palette.access,
		water: paint,
		living: paint,
		food: paint,
		material: paint,
		energy: paint
	};
}
/** Projects the same surveyed assembly in the bible and the sandbox. */
export function sectionParts(section: Section, palette = houseSurfaces) {
	const surfaces = programmeSurfaces(section, palette);
	const house = [
		...houseStructure(section, surfaces),
		...section.slots.flatMap((b) => bodyParts(b, surfaces))
	];
	const walk = access(section, surfaces).map((p) =>
		p.kind === 'prism' && p.height < 0.12 ? { ...p, z: p.z + p.height - 0.12, height: 0.12 } : p
	);
	const seats =
		section.compact || section.composition.path === 'spiral'
			? []
			: landingSeats(walk, house, surfaces.deck);
	return [
		...house,
		...seats,
		...servicePipes(section, surfaces),
		...walk,
		...landingPeople(walk, house, section.id, section.seed, surfaces),
		...section.composition.people.flatMap((p, i) =>
			person(p.position, section.id + '/people/' + i, section.seed, surfaces)
		)
	];
}
