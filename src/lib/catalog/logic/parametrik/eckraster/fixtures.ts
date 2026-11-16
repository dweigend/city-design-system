import type { Patch } from './topology';
import { apply, initialOccupancy, type Occupancy } from './state';
import type { FunktionId } from './funktion';
export type FixtureName =
	'huelle' | 'hochweg' | 'hof' | 'quartier' | 'aufstockung' | 'geruestturm' | 'hochweg-turm';
export const fixtureNames: { id: FixtureName; label: string }[] = [
	{ id: 'aufstockung', label: 'Rooftop extension on a historic row' },
	{ id: 'geruestturm', label: 'Frame tower' },
	{ id: 'hochweg-turm', label: 'Elevated walkway existing stock → tower' },
	{ id: 'quartier', label: 'District' },
	{ id: 'huelle', label: 'Shared envelope' },
	{ id: 'hochweg', label: 'Elevated walkway at the existing stock' },
	{ id: 'hof', label: 'Courtyard → garden → gap' }
];
/** Build phases of the frame tower after 134: frame → core → plug-in modules → crown. */
export const phasen = [
	{ value: '1', label: 'Frame' },
	{ value: '2', label: 'Core' },
	{ value: '3', label: 'Plug-in modules' },
	{ value: '4', label: 'Crown' }
];
/** The frame tower shows crowns only in the last phase. */
export const zeigen = (name: FixtureName, phase = 4) => ({
	koepfe: name !== 'geruestturm' || phase >= 4
});
/** Shortest path across neighboring vertices (breadth-first search, deterministic). */
function path(p: Patch, start: string, target: string): string[] {
	const queue = [start],
		prev = new Map<string, string>();
	for (let i = 0; i < queue.length && !queue.includes(target); i++)
		for (const n of p.vertices.find((v) => v.id === queue[i])!.neighbors)
			if (n !== start && !prev.has(n)) {
				prev.set(n, queue[i]);
				queue.push(n);
			}
	const out = [target];
	while (out[0] !== start) out.unshift(prev.get(out[0])!);
	return out;
}
const byId = (p: Patch, id: string) => p.vertices.find((v) => v.id === id)!;
/** Plan angle of a vertex in degrees, 0 = toward the existing building (rim0). */
const angle = (p: Patch, id: string) => {
	const [x, y] = byId(p, id).point;
	return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};
/**
 * Edge-connected ring of 20 cells around the origin and its five neighbors: closing it
 * encloses a six-cell courtyard (large courtyards, not only edge cells).
 */
export function courtRing(p: Patch): string[] {
	const near = new Set(['origin', ...byId(p, 'origin').neighbors]);
	return [
		...new Set(
			p.faces.filter((f) => f.vertices.some((v) => near.has(v))).flatMap((f) => f.vertices)
		)
	].filter((id) => !near.has(id));
}
/** The missing ring cell nearest the camera (south-west), so the garden is visible. */
export const gate = (p: Patch) =>
	courtRing(p).reduce((a, b) =>
		Math.abs(angle(p, a) - 235) <= Math.abs(angle(p, b) - 235) ? a : b
	);
export function fixture(p: Patch, name: FixtureName, phase = 4): Occupancy {
	let o = initialOccupancy(p);
	const set = (id: string, h: number, group: FunktionId = 'wohnen') => {
		o = apply(p, o, { vertexId: id, level: h, occupied: true, group });
	};
	/** Set a structural frame (empty or around the existing plug-in module). */
	const frame = (id: string, levels: number[]) =>
		levels.forEach((h) => {
			o = apply(p, o, { vertexId: id, level: h, occupied: true, group: 'geruest', frame: true });
		});
	const stack = (id: string, levels: number[], group: FunktionId) =>
		levels.forEach((h) => set(id, h, group));
	if (name === 'huelle') stack('origin', [0, 1], 'wohnen');
	if (name === 'hof') {
		for (const id of courtRing(p)) {
			if (id === gate(p)) continue;
			set(id, 0, 'tinte');
			// The far side rises a story: the courtyard stays open above, so the garden survives.
			if (angle(p, id) < 140) set(id, 1, 'wohnen');
		}
	}
	if (name === 'hochweg') {
		// A radial path connects the protected rim to a central water tower.
		const way = path(p, 'rim0', 'origin');
		for (const id of way.slice(1, -1)) set(id, 1, 'wohnen');
		stack('origin', [0, 1, 2], 'wasser');
		// The tower reaches over the walkway: an arcade, the deck below stays open.
		for (const id of way.slice(-3, -1)) set(id, 2, 'wasser');
	}
	if (name === 'aufstockung') {
		// Rooftop extension: housing sits on a parcel and cantilevers into the courtyard (columns).
		for (const id of ['edge:edge:rim0/rim1/rim0', 'center:sector0/1']) stack(id, [3, 4], 'wohnen');
		stack('edge:center:sector0/edge:origin/rim0', [3, 4], 'wohnen');
		// Frame on the neighboring house: two floors of frame, an energy module below.
		for (const id of ['edge:edge:rim0/rim1/rim1', 'center:sector0/2']) frame(id, [4, 5]);
		set('center:sector0/2', 4, 'energie');
		// Greenhouse on the south wing.
		set('center:sector4/2', 4, 'nahrung');
		// White architectural model in the courtyard, linked to the existing house by an elevated walkway at height 2.
		stack('edge:center:sector0/edge:origin/rim1', [0, 1, 2, 3], 'tinte');
		set('center:sector0', 2, 'kreislauf');
	}
	if (name === 'geruestturm') {
		// 134: frame → core → plug-in modules → crown. Six columns, six floors.
		const ring = p.vertices.find((v) => v.id === 'origin')!.neighbors;
		const levels = [0, 1, 2, 3, 4, 5];
		for (const id of ['origin', ...ring]) frame(id, levels);
		// Core: the white model bears (ink), five floors inside the frame.
		if (phase >= 2) stack('origin', [0, 1, 2, 3, 4], 'tinte');
		if (phase >= 3) {
			const farben: FunktionId[] = ['wohnen', 'energie', 'nahrung', 'kreislauf'];
			ring.forEach((id, i) =>
				levels.forEach((h) => {
					// Checkerboard with gaps: modules only in every second bay, open at the bottom.
					if (h > 0 && (i + h) % 2 === 0) set(id, h, farben[((i + h) / 2) % farben.length]);
				})
			);
		}
		// Crown: water crowns the core over two floors, the dome sits on top.
		if (phase >= 4) stack('origin', [5, 6], 'wasser');
	}
	if (name === 'hochweg-turm') {
		// Elevated walkway at height 2 from the existing house on the southeast wing to the tower in the middle.
		const way = path(p, 'edge:center:sector4/edge:rim0/rim4', 'origin');
		for (const id of way.slice(1, -1)) set(id, 2, 'wohnen');
		stack('origin', [0, 1, 2, 3, 4, 5, 6], 'wasser');
		// Frame column at the tower with an energy module.
		const nb = 'edge:edge:origin/rim3/origin';
		frame(nb, [0, 1, 2, 3, 4]);
		set(nb, 3, 'energie');
	}
	if (name === 'quartier') {
		// Large courtyard; functions follow the compass, so colors read as wings.
		const enclosing = courtRing(p);
		// The white model bears (ink), colored modules show the function (tower principle, 85 §2).
		// The camera looks from the south-west: far wings rise, near wings stay low.
		const wing = (a: number): FunktionId =>
			a >= 125 && a < 175 ? 'material' : a >= 175 && a < 235 ? 'nahrung' : 'tinte';
		for (const id of enclosing) {
			const a = angle(p, id);
			set(id, 0, wing(a));
			if (a < 60 || a >= 335) set(id, 1, 'wohnen');
			else if (a < 175) set(id, 1, a < 125 ? 'tinte' : 'material');
		}
		set('center:sector0/0', 2, 'wohnen');
		// Greenhouse story on the food wing.
		set('center:sector2/0', 1, 'nahrung');
		// Material wing cantilevers outward on a column; rooftop extension on columns above it.
		set('edge:edge:origin/rim2/rim2', 1, 'material');
		set('edge:center:sector1/edge:origin/rim2', 2, 'wohnen');
		// Elevated walkway from the existing building to the east wing, an arcade (water) above it.
		set('edge:edge:origin/rim0/rim0', 1, 'wohnen');
		set('edge:edge:origin/rim0/rim0', 2, 'wasser');
		set('edge:origin/rim0', 2, 'wasser');
		// Energy tower at the back.
		stack('edge:edge:origin/rim1/rim1', [0, 1, 2], 'energie');
	}
	return o;
}

/** Build cell nearest to the center of the patch (never on the rim). */
export function mitte(p: Patch): string {
	return [...p.vertices]
		.filter((v) => !v.boundary)
		.sort((a, b) => Math.hypot(...a.point) - Math.hypot(...b.point) || (a.id < b.id ? -1 : 1))[0]
		.id;
}
/**
 * Sample for arbitrary patches (grid choice in L10), without existing stock: a
 * stack in the middle, a neighbor with a plinth and a frame bay. Graph only, no fixed IDs.
 */
export function probe(p: Patch): Occupancy {
	let o: Occupancy = {};
	const set = (id: string, h: number, group: FunktionId | 'geruest', frame = false) => {
		o = apply(p, o, { vertexId: id, level: h, occupied: true, group, frame });
	};
	const kern = mitte(p),
		nb = byId(p, kern)
			.neighbors.filter((id) => !byId(p, id).boundary)
			.sort();
	for (const h of [0, 1, 2, 3]) set(kern, h, h < 1 ? 'material' : h < 3 ? 'wohnen' : 'nahrung');
	if (nb[0]) for (const h of [0, 1]) set(nb[0], h, 'kreislauf');
	if (nb[1]) for (const h of [2, 3]) set(nb[1], h, 'wasser');
	if (nb[2]) for (const h of [0, 1, 2]) set(nb[2], h, 'geruest', true);
	return o;
}
