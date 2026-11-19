import type { Vec3 } from '../parametrik/types';
import type { Section } from './types';
import type { HouseSurfaces } from './surfaces';
import { houseObject } from './house-object';
import { edge } from './stair-track';
import type { Station } from './stair-track';

/** Carries one continuous handrail along the outside cheek of the public stair. */
export function flightRail(
	s: Section,
	route: { width: number; legs: { ends: [Station, Station]; from: Vec3; to: Vec3 }[] },
	surfaces: HouseSurfaces
) {
	const id = s.id + '/stair/rail/';
	const stock = houseObject('railing', 'standard', s.seed, {
		instanceId: id,
		slots: { frame: surfaces.frame }
	}).parts[0];
	if (stock.kind !== 'pipe') throw Error('Expected a registered rail');
	return route.legs.flatMap(({ ends, from, to }, i) => {
		const a: Vec3 = [...edge(ends[0], route.width / 2 - 0.09), from[2] + 1.1];
		const b: Vec3 = [...edge(ends[1], route.width / 2 - 0.09), to[2] + 1.1];
		const top = { ...stock, id: id + i, radius: 0.06, points: [a, b] };
		return i % 5
			? [top]
			: [top, { ...top, id: top.id + '/post', points: [[a[0], a[1], from[2]] as Vec3, a] }];
	});
}
