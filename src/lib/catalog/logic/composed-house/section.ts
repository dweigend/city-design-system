import { houseStair } from '../../data/house-stair';
import { composeHouse } from '../house-typology';
import type { HouseSite, Section } from './types';

/** Adapts the frozen composition to the painted-house and stair projection seam. */
export function planHouse(site: HouseSite): Section {
	const composition = composeHouse(site, site.context);
	const { cells, levels, crown, core, start, stories } = composition;
	const sign = composition.accessSide === 'north' ? 1 : -1;
	const rear = core.position[1] + sign * 0.15;
	const compact = composition.compact;
	const offset = compact ? 0.16 : houseStair.radius + houseStair.width;
	return {
		composition, cells, start, stories, compact,
		id: composition.id, seed: site.seed, district: site.district ?? 'infill',
		typology: composition.typology, base: [core.position[0], core.position[1], composition.ground],
		width: Math.max(...levels.map(l => l.width)), depth: Math.max(...levels.map(l => l.depth)),
		top: crown.position[2], decks: levels, slots: levels.flatMap(l => l.bodies).concat(crown),
		stairAxis: [core.position[0], rear + sign * offset]
	};
}
