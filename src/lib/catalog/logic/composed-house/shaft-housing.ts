import { houseObject } from './house-object';
import { roleSurface, type HouseSurfaces } from './surfaces';
import type { Section } from './types';

/** Encloses an exterior ladder in a folded facade panel carried by the plinth. */
export function shaftHousing(s: Section, surfaces: HouseSurfaces) {
	if (s.typology !== 'block' || !s.composition.levels.some((l) => l.bodies[0].band?.modules))
		return [];
	const [x, y] = s.stairAxis,
		sign = s.composition.accessSide === 'north' ? 1 : -1;
	return s.composition.levels.map((l, i) => {
		const b = l.bodies[0],
			facade = b.position[1] + (sign * b.size[1]) / 2;
		const outer = y + sign * 0.11,
			inner = y + sign * 0.075;
		const paint = roleSurface(surfaces[b.band?.shell ? 'shell' : b.use], 'capsule');
		const p = houseObject('primitive-slab', 'square', s.seed, {
			instanceId: b.id + '/' + b.objectId + '/ladder-housing',
			slots: { body: paint }
		}).parts[0];
		if (p.kind !== 'prism') throw Error('Expected folded wall profile');
		const polygon: [number, number][] = [
			[x - 0.4, facade],
			[x - 0.4, outer],
			[x + 0.4, outer],
			[x + 0.4, facade],
			[x + 0.32, facade],
			[x + 0.32, inner],
			[x - 0.32, inner],
			[x - 0.32, facade]
		];
		return {
			...p,
			polygon: sign > 0 ? polygon.reverse() : polygon,
			z: b.position[2] + 0.18,
			height:
				(i === s.composition.levels.length - 1 ? s.top - b.position[2] - 0.16 : b.size[2]) - 0.18
		};
	});
}
