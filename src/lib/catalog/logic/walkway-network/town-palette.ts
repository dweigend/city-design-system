import { publicPaving } from './town-floor';
import { houseSurfaces } from '../composed-house';
import type { Primitive } from '../parametrik/types';

/** Assigns neutral decking to non-public access surfaces in the town palette. */
export function privateSurface(p: Primitive): Primitive {
	const access = houseSurfaces.access.token,
		neutral = houseSurfaces.deck.token;
	if (p.token === access) p = { ...p, token: neutral };
	if (p.overprint === access) p = { ...p, overprint: neutral };
	if (p.kind === 'prism' && p.topToken === access) p = { ...p, topToken: neutral };
	if (p.kind === 'capsule' && p.printBand?.upper === access)
		p = { ...p, printBand: { ...p.printBand, upper: neutral } };
	return p;
}

/** Surface-slot assignments for projecting public-path geometry into the existing scene. */
export const pathSurfaces = {
	walking: {
		role: 'neu',
		material: 'acrylic',
		token: houseSurfaces.access.token,
		finish: 'kunststoff-formteil'
	},
	guard: {
		role: 'neu',
		material: 'metal',
		...houseSurfaces.frame,
		token: houseSurfaces.shell.token
	},
	structure: { role: 'neu', material: 'metal', ...houseSurfaces.frame },
	bearing: { role: 'neu', ...publicPaving }
} as const satisfies Record<string, Pick<Primitive, 'role' | 'material' | 'token' | 'finish'>>;

/** Low-gloss court turf and its two stone edge treatments. */
export const courtSurfaces = {
	lawn: { role: 'neu', material: 'concrete', token: '--cat-lawn' },
	rim: { token: '--cat-nature-2', finishes: ['beton-terrazzo', 'beton-schalung'] }
} as const;
