import { profile, penetration } from '../../src/lib/catalog/logic/house-typology/fit-geometry';
import { partsIntersect, type Solid } from '../../src/lib/catalog/logic/house-typology';
import type { planHouse } from '../../src/lib/catalog/logic/composed-house';

type Section = ReturnType<typeof planHouse>;
const eps = 1e-8;
function entry(p: Solid, owner: number) {
	const shape = profile(p);
	return { p, owner, box: shape.bounds, faces: shape.faces ?? [shape.polygon ?? shape.bottom] };
}
type Entry = ReturnType<typeof entry>;
function planOverlap(a: Entry, b: Entry, threshold: number) {
	return a.faces.some(
		(f) => f.length && b.faces.some((g) => g.length && penetration(f, g) >= threshold)
	);
}
function touches(a: Entry, b: Entry) {
	if (a.box.min.some((n, k) => n > b.box.max[k] + eps || b.box.min[k] > a.box.max[k] + eps))
		return false;
	return planOverlap(a, b, -eps);
}
function body(e: Entry) {
	return e.p.joint === 'body' || e.p.joint === 'capsule';
}
function merge(labels: number[], i: number, j: number) {
	const old = labels[j],
		next = labels[i];
	if (old !== next) for (let k = 0; k < labels.length; k++) if (labels[k] === old) labels[k] = next;
}
function contactGraph(entries: Entry[]) {
	const labels = entries.map((_, i) => i),
		joined = new Set<number>();
	let collisions = 0;
	for (const [i, a] of entries.entries())
		for (let j = 0; j < i; j++) {
			const b = entries[j];
			if (!touches(a, b)) continue;
			if (body(a) && body(b) && partsIntersect(a.p, b.p)) collisions++;
			if (a.owner !== b.owner) {
				joined.add(a.owner);
				joined.add(b.owner);
			}
			merge(labels, i, j);
		}
	return {
		components: new Set(labels.filter((_, i) => body(entries[i]))).size,
		joined,
		collisions
	};
}
// A bearing rim may separate an occupied upper body from its lower rooms.
function supports(lower: Entry, upper: Entry) {
	return Math.abs(lower.box.max[2] - upper.box.min[2]) < eps && planOverlap(lower, upper, eps);
}
function spans(upper: Entry, bodies: Entry[], plates: Entry[]) {
	const seats = plates.filter((p) => supports(p, upper));
	return (
		bodies.filter(
			(b) => planOverlap(b, upper, eps) && (supports(b, upper) || seats.some((p) => supports(b, p)))
		).length >= 2
	);
}
function skyRooms(bodies: Entry[]) {
	const pairs = new Set<string>();
	for (const [i, a] of bodies.entries())
		for (const b of bodies.slice(i + 1)) {
			if (a.owner === b.owner || !touches(a, b) || Math.abs(a.box.min[2] - b.box.min[2]) > eps)
				continue;
			const level = a.box.min[2] - 1;
			const below = (owner: number) =>
				bodies.filter((p) => p.owner === owner && p.box.min[2] < level && p.box.max[2] > level);
			const left = below(a.owner),
				right = below(b.owner);
			if (left.length && right.length && !left.some((p) => right.some((q) => touches(p, q))))
				pairs.add([a.owner, b.owner].join('/'));
		}
	return pairs;
}
/** Counts components containing occupied rooms. Slim supports, circulation and ornaments cannot join masses. */
export function massGraph(houses: Section[]) {
	const lots = houses.map((h, k) =>
		h.composition.parts
			.filter((p) => ['deck', 'body', 'attic', 'capsule'].includes(p.joint))
			.map((p) => entry(p, k))
	);
	const entries = lots.flat(),
		bodies = entries.filter(body),
		plates = entries.filter((p) => p.p.joint === 'deck');
	const { components, joined, collisions } = contactGraph(entries);
	const galleries = skyRooms(bodies);
	const missingGalleries = houses.flatMap((a, i) =>
		houses.flatMap((b, j) => {
			if (i >= j || a.stories < 5 || b.stories < 5 || a.composition.ground !== b.composition.ground)
				return [];
			const adjacent = a.cells.some((c) => b.cells.some((d) => c.neighbors.includes(d.id)));
			return adjacent && !galleries.has([i, j].join('/')) ? [a.id + ' / ' + b.id] : [];
		})
	);
	return {
		missingGalleries,
		components,
		byHouse: lots.map((l) => contactGraph(l).components),
		joined: joined.size / houses.length,
		spanning: bodies.filter((b) => spans(b, bodies, plates)).length,
		inhabitedBridges: galleries.size,
		collisions
	};
}
