import { STORY } from '../../data/grid';
import { stairAxis } from './stair-fit';
import { composeHouse, housePath } from '../house-typology';
import type { HouseSite, Section } from './types';

/** Adapts the frozen composition to the painted-house and stair projection seam. */
export function planHouse(site: HouseSite): Section {
	const composition = composeHouse(site, site.context);
	const { cells, levels, crown, core, start, stories } = composition;
	const sign = composition.accessSide === 'north' ? 1 : -1;
	const rear = core.position[1] + sign * 0.15;
	const offset = composition.compact ? -0.04 : 0.2;
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
		slots: levels.flatMap((l) => l.bodies).concat(crown),
		stairAxis: [core.position[0], rear + sign * offset]
	};
	const path = housePath(section.typology);
	if (path === 'ladder') return section;
	if (path !== 'spiral') {
		section.compact = composition.compact;
		return section;
	}
	const axis = stairAxis(section, rear, sign);
	if (axis) {
		section.stairAxis = axis;
		section.compact = false;
	}
	return section;
}
