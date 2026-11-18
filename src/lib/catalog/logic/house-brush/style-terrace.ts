import type { Primitive } from '../parametrik/types';
import { body } from './body';
import { crowns } from './crowns';
import type { Site } from './form';
import type { Mass } from './massing';
import { profileOf } from './profile';

/** Terrace style: white walls under floor plates, stepped roofs, a totem per use. */
export function terraceMass(site: Site, mass: Mass): Primitive[] {
	const profile = profileOf(site, mass);
	return [...body(site, mass, profile), ...crowns(site, mass, profile.tiers * profile.rise)];
}
