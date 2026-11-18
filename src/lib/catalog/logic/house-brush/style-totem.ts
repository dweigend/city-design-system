import type { Primitive } from '../parametrik/types';
import type { Site } from './form';
import type { Mass } from './massing';
import { terraceMass } from './style-terrace';

/** Totem style: stacked bold solids in full color and pattern. */
export function totemMass(site: Site, mass: Mass): Primitive[] {
	return terraceMass(site, mass);
}
