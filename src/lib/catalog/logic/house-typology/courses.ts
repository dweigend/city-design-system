import type { Typology } from './families';
import type { Plan } from './types';

type Course = (i: number, n: number) => boolean;
const every: Course = () => true;
const first: Course = (i) => i === 0;
const last: Course = (i, n) => i === n - 1;
const upper: Course = (i, n) => i >= Math.min(n - 1, Math.max(1, n - 2));
const ends: Course = (i, n) => first(i, n) || last(i, n);
const none: Course = () => false;
const sparse =
	(count: number): Course =>
	(i, n) =>
		Array.from({ length: Math.min(count, n) }, (_, k) =>
			Math.round((k * (n - 1)) / (Math.min(count, n) - 1 || 1))
		).includes(i);

const courses: Record<Typology, { occupied: Course; floor: Course }> = {
	'capsule-stack': { occupied: every, floor: none },
	'deck-tower': {
		occupied: (i, n) => (n === 3 ? ends(i, n) : n <= 4 || sparse(3)(i, n)),
		floor: every
	},
	'round-tower': { occupied: every, floor: every },
	'portal-house': { occupied: upper, floor: upper },
	'lattice-head': { occupied: (i, n) => i >= Math.floor(n * 0.7), floor: every },
	'courtyard-house': { occupied: every, floor: last },
	'terrace-house': { occupied: every, floor: every },
	'plinth-house': { occupied: every, floor: first },
	'cluster-mast': { occupied: every, floor: none },
	rack: { occupied: every, floor: every },
	'bridge-house': { occupied: last, floor: last },
	'bell-house': { occupied: ends, floor: last },
	'twin-stack': { occupied: every, floor: ends },
	'slab-house': { occupied: every, floor: none },
	'water-house': { occupied: (i, n) => ends(i, n) || (n > 8 && i % 4 === 0), floor: first },
	'tree-house': { occupied: (i, n) => i >= n - 3, floor: every }
};

/** Selects the painted bands that carry bodies, preserving their vertical order. */
export function courseIndices({ site, type }: Plan) {
	const n = site.programme.length;
	return Array.from({ length: n }, (_, i) => i).filter(
		(i) => courses[type].occupied(i, n) || i === n - 1
	);
}

/** Distinguishes full occupied plates from the consoles carried by a narrow access landing. */
export function hasFloor(plan: Plan, i: number) {
	return courses[plan.type].floor(i, plan.site.programme.length);
}
