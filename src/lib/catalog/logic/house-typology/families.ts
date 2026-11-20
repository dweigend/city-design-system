import type { Survey } from './survey';
export const wideTypologies = [
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
export const typologies = [...wideTypologies, 'block'] as const;
export type Typology = (typeof typologies)[number];
export type HouseRole = 'high' | 'medium' | 'bar' | 'plinth';
type Suitability = {
	site: Survey;
	role: HouseRole;
	n: number;
	h: number;
	uses: ReadonlySet<string>;
	living: boolean;
	green: boolean;
	tall: boolean;
};
const suitability: Record<Typology, (factors: Suitability) => number> = {
	block: () => 0,
	'capsule-stack': ({ living, n }) => (living && n <= 2 ? 14 : 1),
	'deck-tower': ({ uses, h }) => (uses.size > 1 && h >= 3 ? 12 : 2),
	'round-tower': ({ site, h }) =>
		site.district === 'bank' && h >= 6 && Math.min(site.width, site.depth) >= 9 ? 25 : 0,
	'portal-house': ({ site, n }) => (site.elongated && n === 2 ? 12 : 0),
	'lattice-head': ({ role, tall }) => (tall && role === 'high' ? 18 : 0),
	'courtyard-house': ({ site, n, h }) =>
		n >= 4 && !site.elongated && h <= 3 && Math.min(site.width, site.depth - 2.55) >= 10 ? 20 : 0,
	'terrace-house': ({ site, n }) => (site.district === 'slope' && n >= 2 ? 19 : 0),
	'plinth-house': ({ h }) => (h <= 3 ? 12 : 0),
	'cluster-mast': ({ living, h }) => (living && h >= 3 ? 9 : 1),
	rack: ({ uses, n }) => (n >= 2 || uses.size > 1 ? 9 : 1),
	'bridge-house': ({ site, n, living, h }) =>
		site.elongated && n <= 3 && !living && h <= 3 ? 12 : 0,
	'bell-house': ({ green, living, h }) => (h > 12 ? 0 : green ? 13 : living ? 0 : 2),
	'twin-stack': ({ living, n }) => (living && n >= 2 ? 8 : 0),
	'slab-house': ({ site, living }) => (living && site.elongated ? 10 : 1),
	'water-house': ({ uses }) => (uses.has('water') ? 12 : 0),
	'tree-house': ({ green, h }) => (green && h >= 2 && h <= 12 ? 10 : 0)
};
/** Relative typology suitability for the painted site and its fixed skyline role. */
export function affinities(s: Survey, role: HouseRole): Record<Typology, number> {
	const n = s.cells.length,
		h = s.programme.length,
		uses = new Set(s.programme.flat());
	const living = uses.has('living'),
		green = uses.has('food'),
		tall = h >= 5;
	const factors = { site: s, role, n, h, uses, living, green, tall };
	const weight = (type: Typology) => {
		if (s.compact) return Number(type === 'block');
		return suitability[type](factors);
	};
	// Every typology contributes one entry in the canonical order.
	return Object.fromEntries(typologies.map((type) => [type, weight(type)])) as Record<
		Typology,
		number
	>;
}
