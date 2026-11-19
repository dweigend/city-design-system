import type { Typology } from './families';
import type { HouseComposition } from './types';

const forms = {
	'capsule-stack': ['mast', 'landings only', 'alternating', 'slim'],
	'deck-tower': ['posts', 'few wide', 'alternating', 'wide'],
	'round-tower': ['drum', 'every level', 'ring', 'ring'],
	'portal-house': ['two cores', 'few wide', 'lying bar', 'gate'],
	'lattice-head': ['lattice shaft', 'few wide', 'single', 'top-heavy'],
	'courtyard-house': ['ring', 'landings only', 'ring', 'ring'],
	'terrace-house': ['posts', 'every level', 'stepped', 'stepped'],
	'plinth-house': ['plinth', 'few wide', 'single', 'wide'],
	'cluster-mast': ['mast', 'landings only', 'helix', 'top-heavy'],
	rack: ['posts', 'every level', 'frame bays', 'wide'],
	'bridge-house': ['posts', 'few wide', 'lying bar', 'wide'],
	'bell-house': ['posts', 'few wide', 'single', 'wide'],
	'twin-stack': ['two cores', 'few wide', 'frame bays', 'slim'],
	'slab-house': ['slab', 'landings only', 'alternating', 'wide'],
	'water-house': ['drum', 'few wide', 'single', 'top-heavy'],
	'tree-house': ['mast', 'few wide', 'stepped', 'top-heavy']
} as const satisfies Record<Typology, readonly [string, string, string, string]>;
const stairs = {
	zigzag: 'zigzag',
	spiral: 'spiral',
	core: 'internal',
	court: 'courtyard',
	cascade: 'cascade',
	external: 'plinth stair',
	ladder: 'ladder',
	wall: 'internal'
} as const;

/** Describes the support, floors, inhabited figure and access selected for this site. */
export function silhouette(
	type: Typology,
	path: HouseComposition['path'],
	compact: boolean,
	tall: boolean
) {
	const [base, deck, body, outline] = forms[type];
	const support = tall && (base === 'posts' || base === 'mast') ? 'lattice shaft' : base;
	const stair = compact && path !== 'spiral' ? 'ladder' : stairs[path];
	return { support, deck, body, stair, outline };
}
