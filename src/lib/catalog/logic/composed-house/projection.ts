import { continuousShell } from './continuous-shell';
import { shaftHousing } from './shaft-housing';
import { terraceFurniture } from './terrace-furniture';
import { person } from './people';
import { houseStructure } from './structure';
import { bodyParts } from './provider';
import { houseSurfaces, sectionSurfaces } from './surfaces';
import { accentBody, accentKind } from './accent';
import type { Section } from './types';
import { servicePipes } from './service-pipes';
import { landingSeats } from './landing-seats';
import type { HousePart, StockPart } from './house-object';
import { access } from './access';

/** Projects the same surveyed assembly in the bible and the sandbox. */
export function sectionParts(section: Section, palette = houseSurfaces): HousePart[] {
	const surfaces = sectionSurfaces(section, palette);
	const target = accentBody(section),
		accent = accentKind(section);
	const house = [
		...houseStructure(section, surfaces),
		...continuousShell(
			section.composition,
			section.seed,
			surfaces.shell,
			surfaces.frame,
			section.slottedSkin
		),
		...shaftHousing(section, surfaces).map(cantilever),
		...section.slots.flatMap((b) => {
			const body =
				section.slottedSkin && b.band?.skin
					? { ...b, band: { ...b.band, skin: 'plain' as const } }
					: b;
			return bodyParts(body, surfaces, b === target ? accent : 'none');
		})
	];
	const walk = access(section, surfaces).map((p) => {
		return p.kind === 'prism' && p.height < 0.12
			? { ...p, z: p.z + p.height - 0.12, height: 0.12 }
			: p;
	});
	const seats =
		section.compact || section.composition.path === 'spiral'
			? []
			: landingSeats(walk, house, surfaces.deck);
	return [
		...house,
		...seats.map(cantilever),
		...terraceFurniture(section, house, surfaces),
		...servicePipes(section, surfaces).map(cantilever),
		...walk,
		...section.composition.people.flatMap((p, i) =>
			person(p.position, section.id + '/people/' + i, section.seed, surfaces, 0, p.count).map(
				(member) => ({ ...member, structuralRole: p.structuralRole, carrier: p.carrier })
			)
		)
	];
}

function cantilever(p: StockPart): HousePart {
	return { ...p, structuralRole: 'cantilever' };
}
