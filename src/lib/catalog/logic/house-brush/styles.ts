import type { Primitive } from '../parametrik/types';
import type { Site } from './form';
import type { Mass } from './massing';
import { collageMass } from './style-collage';
import { surveyedMass } from './style-megastructure';
import { terraceMass } from './style-terrace';

/** Looks of the house rule. The massing is shared; a style only decides how a mass is drawn. */
export const HOUSE_STYLES = ['terrace', 'totem', 'megastructure', 'collage'] as const;
export type HouseStyle = (typeof HOUSE_STYLES)[number];

/** One rule per style: a mass on its site becomes parts in the shared render contract. */
export const massRules: Record<HouseStyle, (site: Site, mass: Mass) => Primitive[]> = {
	terrace: terraceMass,
	totem: (site, mass) => surveyedMass(mass, true, site.seed),
	megastructure: (site, mass) => surveyedMass(mass, false, site.seed),
	collage: collageMass
};
