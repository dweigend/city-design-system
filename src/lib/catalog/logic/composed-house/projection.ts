import { continuousShell } from './continuous-shell';
import { shaftHousing } from './shaft-housing';
import { terraceFurniture } from './terrace-furniture';
import { person } from './people';
import { houseStructure } from './structure';
import { bodyParts } from './provider';
import { fieldUse, houseSurfaces, sectionSurfaces, type SectionSurfaces } from './surfaces';
import { accentBody, accentKind } from './accent';
import type { Section } from './types';
import { servicePipes } from './service-pipes';
import { landingSeats } from './landing-seats';
import type { HousePart, StockPart } from './house-object';
import { access } from './access';
import { structureHouse } from './structure-house';

/** Projects the same surveyed assembly in the bible and the sandbox. */
export function sectionParts(section: Section, palette = houseSurfaces): HousePart[] {
	const surfaces = sectionSurfaces(section, palette);
	if (section.composition.structure.principle !== 'layers') return framedParts(section, surfaces);
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
		...occupants(section, surfaces)
	];
}

function occupants(section: Section, surfaces: SectionSurfaces): HousePart[] {
	return section.composition.people.flatMap((p, i) =>
		person(p.position, section.id + '/people/' + i, section.seed, surfaces, 0, p.count).map(
			(member) => ({ ...member, structuralRole: p.structuralRole, carrier: p.carrier })
		)
	);
}

/**
 * A house that is not layered draws its structure contract and keeps its stair. Its cloth wears
 * the house's own field use; its people stay inside, since the decks they were planned on are
 * not built.
 */
function framedParts(section: Section, surfaces: SectionSurfaces): HousePart[] {
	const { structure } = section.composition,
		use = fieldUse(section);
	const skins = structure.skins.map((skin) => ({ ...skin, use }));
	const frame = structureHouse({ ...structure, skins }, surfaces).filter(
		(part) => !part.id.endsWith('/access')
	);
	return [...frame, ...access(section, surfaces)];
}

function cantilever(p: StockPart): HousePart {
	return { ...p, structuralRole: 'cantilever' };
}
