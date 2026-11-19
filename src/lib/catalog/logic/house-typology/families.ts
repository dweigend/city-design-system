import type { Survey } from './survey';
export const typologies = [
	'capsule-stack',
	'deck-tower',
	'round-tower',
	'portal-house',
	'lattice-head',
	'courtyard-house',
	'terrace-house',
	'plinth-house',
	'cluster-mast',
	'rack',
	'bridge-house',
	'bell-house',
	'twin-stack',
	'slab-house',
	'water-house',
	'tree-house'
] as const;
export type Typology = (typeof typologies)[number];
export type HouseRole = 'high' | 'medium' | 'bar' | 'plinth';
/** Relative typology suitability for the painted site and its fixed skyline role. */
export function affinities(s: Survey, role: HouseRole): Record<Typology, number> {
	const n = s.cells.length,
		h = s.programme.length,
		uses = new Set(s.programme.flat());
	const living = uses.has('living'),
		green = uses.has('food'),
		tall = h >= 5;
	return {
		'capsule-stack': living && n <= 2 ? 14 : 1,
		'deck-tower': uses.size > 1 && h >= 3 ? 12 : 2,
		'round-tower': s.district === 'bank' && h >= 6 ? 25 : 0,
		'portal-house': s.elongated && n >= 2 ? 12 : 0,
		'lattice-head': tall && role === 'high' ? 18 : 0,
		'courtyard-house': n >= 3 && !s.elongated && h <= 3 ? 20 : 0,
		'terrace-house': s.district === 'slope' && n >= 2 ? 19 : 0,
		'plinth-house': h <= 3 || role === 'plinth' ? 12 : 1,
		'cluster-mast': living && h >= 3 ? 9 : 1,
		rack: n >= 2 || uses.size > 1 ? 9 : 1,
		'bridge-house': s.elongated ? 12 : 0,
		'bell-house': green ? 13 : 2,
		'twin-stack': living && n >= 2 ? 8 : 0,
		'slab-house': living && s.elongated ? 10 : 1,
		'water-house': uses.has('water') ? 12 : 0,
		'tree-house': green && h >= 2 ? 10 : 0
	};
}
