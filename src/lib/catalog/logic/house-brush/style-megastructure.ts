import type { Primitive } from '../parametrik/types';
import type { Site } from './form';
import type { Mass } from './massing';
import { terraceMass } from './style-terrace';

/** Megastructure style: a visible frame carries plugged-in capsules and tubes. */
export function megastructureMass(site: Site, mass: Mass): Primitive[] {
	return terraceMass(site, mass);
}
