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
