import type { HouseUse } from '../../data/house-body';
import { continuousShell } from './continuous-shell';
import { shaftHousing } from './shaft-housing';
import { terraceFurniture } from './terrace-furniture';
import { person } from './people';
import { houseStructure } from './structure';
import { bodyParts } from './provider';
import { houseSurfaces, sectionSurfaces, type BandAccent, type HouseSurfaces } from './surfaces';
import { accentBody, accentKind } from './accent';
import type { Section } from './types';
import { servicePipes } from './service-pipes';
import { landingSeats } from './landing-seats';
import type { HousePart, StockPart } from './house-object';
import { access } from './access';
import { structureHouse } from './structure-house';

function leadingUse(section: Section) {
	const counts = new Map<HouseUse, number>();
	for (const deck of section.decks)
		for (const use of deck.programme) counts.set(use, (counts.get(use) ?? 0) + 1);
	return [...counts].sort((a, b) => b[1] - a[1])[0][0];
}

function accentParts(parts: HousePart[], kind: BandAccent, use: HouseUse) {
	const windowOnly = kind === 'window' && parts.some((p) => p.buildingSurface?.slot === 'pane');
	return parts.map((part) => {
		const surface = part.buildingSurface;
		if (!surface) return part;
		const painted =
			(surface.slot === 'shell' && !windowOnly) ||
			(surface.slot === 'pane' && (windowOnly || kind === 'anchor'));
		return painted ? { ...part, buildingSurface: { ...surface, accentUse: use } } : part;
	});
}

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
			return b === target
				? accentParts(bodyParts(body, surfaces, accent), accent, leadingUse(section))
				: bodyParts(body, surfaces);
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

function occupants(section: Section, surfaces: HouseSurfaces): HousePart[] {
	return section.composition.people.flatMap((p, i) =>
		person(p.position, section.id + '/people/' + i, section.seed, surfaces, 0, p.count).map(
			(member) => ({ ...member, structuralRole: p.structuralRole, carrier: p.carrier })
		)
	);
}

/** A house that is not layered draws its structure contract; its stair and people stay. */
function framedParts(section: Section, surfaces: HouseSurfaces): HousePart[] {
	const frame = structureHouse(section.composition.structure, surfaces).filter(
		(part) => !part.id.endsWith('/access')
	);
	return [...frame, ...access(section, surfaces), ...occupants(section, surfaces)];
}

function cantilever(p: StockPart): HousePart {
	return { ...p, structuralRole: 'cantilever' };
}
