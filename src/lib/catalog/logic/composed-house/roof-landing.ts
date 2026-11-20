import type { Vec3 } from '../parametrik/types';
import type { Section } from './types';

/** The roof exit sits at the rear edge of the crown's bearing plate. */
export function roofLanding(s: Section): Vec3 {
	const { core, accessSide } = s.composition;
	if (s.composition.levels[0].bodies[0].band?.footprint)
		return [core.position[0], s.composition.levels[0].landing[1], s.top];
	const x = s.composition.compact ? s.composition.levels[0].landing[0] : core.position[0];
	return [x, core.position[1] + (accessSide === 'north' ? 0.15 : -0.15), s.top];
}
