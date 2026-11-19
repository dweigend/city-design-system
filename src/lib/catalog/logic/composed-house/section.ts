import { accessShare } from './access-budget';
import { sectionParts } from './projection';
import { STORY } from '../../data/grid';
import { stairAxis } from './stair-fit';
import { composeHouse } from '../house-typology';
import type { HouseSite, Section } from './types';

function ladderOffset(h: Section['composition']) {
	if (h.compact) return -0.04;
	return h.typology === 'tree-house' ? 1.05 : 0.2;
}
/** Adapts the frozen composition to the painted-house and stair projection seam. */
export function planHouse(site: HouseSite): Section {
	const composition = composeHouse(site, site.context);
	const { cells, levels, crown, core, start, stories } = composition;
	const sign = composition.accessSide === 'north' ? 1 : -1;
	const rear = core.position[1] + sign * 0.15;
	const offset = ladderOffset(composition);
	const section: Section = {
		composition,
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
		top: composition.ground + stories * STORY,
		decks: levels,
		slots: levels.flatMap((l) => l.bodies).concat(crown, composition.fittings),
		stairAxis: [core.position[0], rear + sign * offset]
	};
	return fitAccess(section, sign);
}
function fitAccess(section: Section, sign: number): Section {
	const { composition, stories } = section;
	const path = composition.path;
	if (composition.levels[0].well) {
		section.compact = false;
		section.stairAxis = [composition.bay.x, composition.bay.y];
		return section;
	}
	if (path === 'ladder') {
		if (section.typology === 'tree-house' && !composition.compact)
			section.stairAxis = [composition.bay.x, composition.bay.y - 1.85];
		return section;
	}
	if (path !== 'spiral') {
		section.compact = composition.compact;
		if (!section.compact && stories === 1 && accessShare(sectionParts(section)) > 0.1) {
			section.compact = true;
			composition.path = 'ladder';
			composition.signature.stair = 'ladder';
		}
		return section;
	}
	const axis = stairAxis(section, section.base[1] + sign * 0.15, sign);
	if (axis) {
		const winding = { ...section, stairAxis: axis, compact: false };
		if (!composition.compact || accessShare(sectionParts(winding)) <= 0.1) return winding;
	}
	composition.path = 'ladder';
	composition.signature.stair = 'ladder';
	return section;
}
