import { houseObject } from './house-object';
import { roleSurface, type SectionSurfaces } from './surfaces';
import { accentBody } from './accent';
import type { Section } from './types';

/** Encloses an exterior ladder in a folded facade panel carried by the plinth. */
export function shaftHousing(s: Section, surfaces: SectionSurfaces) {
	if (s.typology !== 'block' || !s.composition.levels.some((l) => l.bodies[0].band?.modules))
		return [];
	const [x, y] = s.stairAxis,
		sign = s.composition.accessSide === 'north' ? 1 : -1;
	const accent = accentBody(s);
	return s.composition.levels.map((l, i) => {
		const b = l.bodies[0],
			facade = b.position[1] + (sign * b.size[1]) / 2;
		const outer = y + sign * 0.11,
			inner = y + sign * 0.075;
		// The ladder housing takes the programme colour on the accent body only and is structure-grey
		// elsewhere, so the house keeps exactly one coloured body.
		const paint = roleSurface(b === accent ? surfaces[b.use] : surfaces.frame, 'fitting');
		const p = houseObject('primitive-slab', 'square', s.seed, {
			instanceId: b.id + '/' + b.objectId + '/ladder-housing',
			slots: { body: paint }
		}).parts[0];
		if (p.kind !== 'prism') throw Error('Expected folded wall profile');
		const polygon: [number, number][] = [
			[x - 0.64, facade],
			[x - 0.64, outer],
			[x + 0.64, outer],
			[x + 0.64, facade],
			[x + 0.56, facade],
			[x + 0.56, inner],
			[x - 0.56, inner],
			[x - 0.56, facade]
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
