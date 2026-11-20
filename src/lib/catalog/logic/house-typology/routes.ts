import type { Typology } from './families';

const paths = {
	block: 'ladder',
	'capsule-stack': 'zigzag',
	'deck-tower': 'zigzag',
	'round-tower': 'spiral',
	'portal-house': 'core',
	'lattice-head': 'core',
	'courtyard-house': 'court',
	'terrace-house': 'cascade',
	'plinth-house': 'external',
	'cluster-mast': 'zigzag',
	rack: 'zigzag',
	'bridge-house': 'core',
	'bell-house': 'ladder',
	'twin-stack': 'core',
	'slab-house': 'wall',
	'water-house': 'zigzag',
	'tree-house': 'ladder'
} as const satisfies Record<Typology, string>;

/** The single circulation system specified by the typology. */
export function housePath(type: Typology) {
	return paths[type];
}

/** Allocates the spiral allowance before selecting the ensemble palette. */
export function paletteCount(a: Typology, b: Typology, size: number) {
	const allowance = Math.floor(size / 3);
	if (housePath(a) === 'spiral') return housePath(b) === 'spiral' ? 0 : allowance;
	return housePath(b) === 'spiral' ? size - allowance : Math.ceil(size / 2);
}
