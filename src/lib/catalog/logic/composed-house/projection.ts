import { continuousShell } from './continuous-shell';
import { shaftHousing } from './shaft-housing';
import { terraceFurniture } from './terrace-furniture';
import { person } from './people';
import { houseStructure } from './structure';
import { bodyParts } from './provider';
import { houseSurfaces } from './surfaces';
import { accentBody, accentKind } from './accent';
import type { Section } from './types';
import { servicePipes } from './service-pipes';
import { landingSeats } from './landing-seats';
import type { HousePart, StockPart } from './house-object';
import { access } from './access';

function programmeSurfaces(section: Section, palette: typeof houseSurfaces) {
	const counts = new Map<Section['slots'][number]['use'], number>();
	for (const use of section.decks.flatMap((l) => l.programme))
		counts.set(use, (counts.get(use) ?? 0) + 1);
	const leading = [...counts].sort((a, b) => b[1] - a[1])[0][0];
	const paint = palette[leading];
	const useSurface = (key: typeof leading) =>
		palette[key] === houseSurfaces[key] ? paint : palette[key];
	return {
		...palette,
		water: useSurface('water'),
		living: useSurface('living'),
		food: useSurface('food'),
		material: useSurface('material'),
		energy: useSurface('energy')
	};
}
/** Projects the same surveyed assembly in the bible and the sandbox. */
export function sectionParts(section: Section, palette = houseSurfaces): HousePart[] {
	const surfaces = programmeSurfaces(section, palette);
	const target = accentBody(section),
		accent = accentKind(section);
	const house = [
		...houseStructure(section, surfaces),
		...continuousShell(section.composition, section.seed, surfaces.shell),
		...shaftHousing(section, surfaces).map(cantilever),
		...section.slots.flatMap((b) => bodyParts(b, surfaces, b === target ? accent : 'none'))
	];
	const walk = access(section, surfaces).map((part) => {
		const p = walkingFace(part, surfaces);
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

function walkingFace(p: HousePart, surfaces: typeof houseSurfaces): HousePart {
	if (
		p.kind !== 'prism' ||
		surfaces.access !== houseSurfaces.access ||
		p.token !== surfaces.access.token
	)
		return p;
	return { ...p, topToken: p.token };
}
