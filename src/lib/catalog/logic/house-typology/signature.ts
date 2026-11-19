import type { Typology } from './families';
import type { housePath } from './routes';

const forms = {
	'capsule-stack': ['mast', 'landings only', 'alternating', 'slim'],
	'deck-tower': ['posts', 'spaced rims', 'alternating', 'wide'],
	'round-tower': ['drum', 'every level', 'ring', 'ring'],
	'portal-house': ['two cores', 'shifted rim', 'lying bar', 'gate'],
	'lattice-head': ['lattice shaft', 'shifted rim', 'single', 'top-heavy'],
	'courtyard-house': ['ring', 'shifted rim', 'ring', 'ring'],
	'terrace-house': ['posts', 'shifted rim', 'stepped', 'stepped'],
	'plinth-house': ['plinth', 'broad base rim', 'single', 'wide'],
	'cluster-mast': ['mast', 'landings only', 'helix', 'top-heavy'],
	rack: ['posts', 'shifted rim', 'frame bays', 'wide'],
	'bridge-house': ['posts', 'shifted rim', 'lying bar', 'wide'],
	'bell-house': ['posts', 'few wide', 'single', 'wide'],
	'twin-stack': ['two cores', 'shifted rim', 'frame bays', 'slim'],
	'slab-house': ['slab', 'shifted rim', 'alternating', 'wide'],
	'water-house': ['drum', 'base and tank rims', 'single', 'top-heavy'],
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
	path: ReturnType<typeof housePath>,
	compact: boolean,
	tall: boolean
) {
	const [base, deck, body, outline] = forms[type];
	const support = tall && (base === 'posts' || base === 'mast') ? 'lattice shaft' : base;
	const stair = compact && path !== 'spiral' ? 'ladder' : stairs[path];
	return { support, deck, body, stair, outline };
}
