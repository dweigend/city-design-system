import type { Primitive } from '../parametrik/types';
import type { Site } from './form';
import type { Mass } from './massing';
import { terraceMass } from './style-terrace';

/** Collage style: light pencil volumes with single graphic, surreal elements. */
export function collageMass(site: Site, mass: Mass): Primitive[] {
	return terraceMass(site, mass);
}
