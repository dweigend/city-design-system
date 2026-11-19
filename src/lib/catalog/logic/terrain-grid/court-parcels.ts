import { kern } from '../parametrik/raster/universal';
import { hash } from '../hash-random';
import { average, coord, get, type Face, type sourceGraph } from './block-graph';
import { cellId } from './types';
import type { Lattice } from './contour-rows';

type Graph = ReturnType<typeof sourceGraph>;
type Child = { ring: string[]; parcel: string };

/** Two frontage parcels of the actual source ring. Each quad leaf supplies two carrier slots. */
function divide(face: Face, graph: Graph, seed: number, profile: Lattice['profile']) {
	const polygon = face.ring.map((id) => get(graph.positions, id));
	const [x, y] = coord(face.id);
	const firstCut = kern.cutRatios[Math.floor(hash(seed, x, y) * kern.cutRatios.length)];
	const minArea = profile.minParcelArea * 2;
	if (kern.area(polygon) < 2 * minArea) return;
	// The terrain circulation plan determines access after projection.
	const leaves = Array.from(kern.parcelCuts(polygon, firstCut)).find((parts) =>
		parts.every((p) => p.length === 4 && kern.area(p) >= minArea)
	);
	if (!leaves) return;
	const points = new Map<string, kern.Vec>(),
		children: Child[] = [];
	const center = cellId(x + 1, y + 1);
	let seam: readonly [string, string] | undefined;
	for (const [index, polygonLeaf] of leaves.entries()) {
		// The two original corners identify the end of the leaf opposite its cut.
		const corner = (v: kern.Vec) => polygon.findIndex((p) => p[0] === v[0] && p[1] === v[1]);
		const end = polygonLeaf.findIndex(
			(v, i) => corner(v) >= 0 && corner(polygonLeaf[(i + 1) % 4]) >= 0
		);
		if (end < 0) return;
		const [a, b, seamB, seamA] = Array.from({ length: 4 }, (_, i) => polygonLeaf[(end + i) % 4]);
		const i = corner(a),
			left = face.ring[i],
			right = face.ring[(i + 1) % 4];
		const mid = average(left, right),
			lo = average(face.ring[(i + 3) % 4], left),
			hi = average(right, face.ring[(i + 2) % 4]);
		points.set(mid, kern.mix(a, b, 0.5));
		seam = [lo, hi];
		points.set(lo, seamA);
		points.set(hi, seamB);
		if (!points.has(center)) points.set(center, kern.mix(seamA, seamB, 0.5));
		children.push(
			{ ring: [left, mid, center, lo], parcel: kern.childId(face.id, 'parcel', index) },
			{ ring: [right, hi, center, mid], parcel: kern.childId(face.id, 'parcel', index) }
		);
	}
	if (seam) return { points, children, center, seam };
}

/** Publish accepted leaf boundaries before neighbors are subdivided so both own the same seam. */
export function courtParcels(
	graph: Graph,
	width: number,
	height: number,
	seed: number,
	profile: Lattice['profile'],
	enabled: boolean,
	allowed?: ReadonlySet<string>
) {
	const points = new Map<string, kern.Vec>(),
		blocks = new Map<string, Child[]>(),
		seams = new Map<string, readonly [string, string]>();
	const courts = new Set<string>();
	const candidates = new Map<string, Map<string, string[]>>();
	if (enabled)
		for (const face of graph.faces.values()) {
			const [x, y] = coord(face.id);
			if (face.ring.length !== 4 || x === 0 || y === 0 || x + 2 >= width || y + 2 >= height)
				continue;
			courts.add(face.id);
			const cut = divide(face, graph, seed, profile);
			if (!cut) continue;
			const leaves = new Map<string, string[]>();
			for (const child of cut.children) {
				const slot = face.slots[face.ring.indexOf(child.ring[0])];
				const slots = leaves.get(child.parcel) ?? [];
				slots.push(slot);
				leaves.set(child.parcel, slots);
			}
			candidates.set(face.id, leaves);
			if (face.ring.some((v, i) => points.has(average(v, face.ring[(i + 1) % 4])))) continue;
			if (allowed && !allowed.has(face.id)) continue;
			for (const [id, p] of cut.points) points.set(id, p);
			blocks.set(face.id, cut.children);
			seams.set(cut.center, cut.seam);
		}
	return { points, blocks, seams, candidates, courts };
}
