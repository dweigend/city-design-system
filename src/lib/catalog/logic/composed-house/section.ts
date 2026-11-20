import { parcelSupports } from './stair-parcel';
import { accessShare, maxAccessShare } from './access-budget';
import { sectionParts } from './projection';
import { STORY } from '../../data/grid';
import { stairAxis } from './stair-fit';
import { composeHouse } from '../house-typology';
import type { HouseSite, Section } from './types';

function ladderOffset(h: Section['composition']) {
	if (h.typology === 'block')
		return h.levels.some((l) => l.bodies[0].band?.modules)
			? Math.max(
					0.12,
					...h.levels.map(
						(l) =>
							Math.abs(
								l.bodies[0].position[1] +
									(l.bodies[0].facing[1] * l.bodies[0].size[1]) / 2 -
									h.bay.y
							) -
							h.bay.depth / 2 +
							0.09
					)
				)
			: -0.39;
	return h.typology === 'tree-house' ? 1.05 : 0.52;
}
/** The roof platform's walking surface; without a roof, the nominal storey height. */
function roofDatum({ structure, ground, stories }: Section['composition']) {
	const { roof, platforms } = structure;
	const walk = roof && roof.kind !== 'skin' && platforms.find((p) => p.id === roof.platform);
	return walk ? walk.datum : ground + stories * STORY;
}
/** Bodies exist only where the structure declares a room, and a crown only where it roofs. */
function occupiedBodies({ structure, levels, crown, fittings }: Section['composition']) {
	const rooms = structure.platforms.filter((platform) => platform.room);
	const bodies = levels
		.filter((level) => rooms.some((room) => room.datum === level.position[2]))
		.flatMap((level) => level.bodies);
	return bodies.concat(structure.roof?.kind === 'crown' ? [crown] : [], fittings);
}
/** Adapts the frozen composition to the painted-house and stair projection seam. */
export function planHouse(site: HouseSite): Section {
	const composition = composeHouse(site, site.context);
	const { cells, levels, core, start, stories } = composition;
	const sign = composition.accessSide === 'north' ? 1 : -1;
	const rear = core.position[1] + sign * 0.15;
	const offset = ladderOffset(composition);
	const section: Section = {
		composition,
		slottedSkin: !site.envelope || Object.keys(site.envelope).length === 0,
		ensemble: site.context ? [...site.context.houses.keys()].sort().join('|') : composition.id,
		cells,
		start,
		stories,
		compact: true,
		id: composition.id,
		seed: site.seed,
		district: site.district ?? 'infill',
		typology: composition.typology,
		base: [core.position[0], core.position[1], composition.ground],
		width: Math.max(...levels.map((l) => l.width)),
		depth: Math.max(...levels.map((l) => l.depth)),
		top: roofDatum(composition),
		decks: levels,
		slots: occupiedBodies(composition),
		stairAxis: [core.position[0], rear + sign * offset]
	};
	if (levels[0].bodies[0].band?.footprint) {
		section.stairAxis = [core.position[0], core.position[1]];
		return section;
	}
	return fitAccess(section, sign);
}
function ladder(section: Section) {
	section.compact = true;
	if (section.typology === 'cluster-mast' && !section.composition.compact)
		section.stairAxis = [
			section.base[0],
			section.base[1] + (section.composition.accessSide === 'north' ? 0.62 : -0.62)
		];
	section.composition.path = 'ladder';
	section.composition.signature.stair = 'ladder';
	return section;
}
function fitsPublicStair(section: Section) {
	const structure = sectionParts(section).filter(
		(p) => !p.source.objectId.startsWith('person-') && !p.id.includes('/furniture/')
	);
	return (
		accessShare(structure) <= maxAccessShare &&
		structure.every(
			(p) =>
				!p.id.includes('/stair/') ||
				p.structuralRole !== 'bearing' ||
				p.kind !== 'prism' ||
				parcelSupports(section, p.polygon)
		)
	);
}
function fitAccess(section: Section, sign: number): Section {
	const { composition } = section;
	const opening = composition.levels[0].well;
	if (opening) return wellAccess(section, sign, opening);
	if (composition.path === 'ladder') {
		if (section.typology === 'tree-house' && !composition.compact)
			section.stairAxis = [composition.bay.x, composition.bay.y - 1.85];
		return section;
	}
	if (composition.path === 'spiral') return fitWinding(section, sign);
	if (composition.compact || composition.flightWidth < 2.5) return ladder(section);
	section.compact = false;
	return fitsPublicStair(section) ? section : ladder(section);
}
function fitWinding(section: Section, sign: number) {
	const axis = stairAxis(section, section.base[1] + sign * 0.15, sign);
	if (axis) {
		const fitted = { ...section, stairAxis: axis, compact: false };
		if (fitsPublicStair(fitted)) return fitted;
	}
	return ladder(section);
}

function wellAccess(
	section: Section,
	sign: number,
	opening: Section['composition']['levels'][number]['outline']
) {
	const { composition } = section;
	section.stairAxis = [composition.bay.x, composition.bay.y];
	section.compact = false;
	const radius = Math.hypot(opening[0][0] - composition.bay.x, opening[0][1] - composition.bay.y);
	if (radius >= 2.55 && fitsPublicStair(section)) return section;
	section.stairAxis = [composition.bay.x, composition.bay.y + sign * (radius - 0.3)];
	return ladder(section);
}
