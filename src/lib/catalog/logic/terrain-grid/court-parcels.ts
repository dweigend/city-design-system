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
	const fronts = face.ring.map((id, i) => ({
		id: kern.edgeId(id, face.ring[(i + 1) % 4]),
		a: polygon[i],
		b: polygon[(i + 1) % 4],
		width: profile.alleyWidth,
		level: 0,
		kind: 'alley' as const
	}));
	const [x, y] = coord(face.id);
	const firstCut = kern.cutRatios[Math.floor(hash(seed, x, y) * kern.cutRatios.length)];
	const minArea = profile.minParcelArea * 2;
	if (kern.area(polygon) < 2 * minArea) return;
	const result = kern.parcelize(face.id, polygon, fronts, {
		firstCut,
		minArea,
		maxArea: kern.area(polygon) - minArea,
		minFront: profile.alleyWidth,
		minWidth: profile.alleyWidth,
		level: 0,
		maxDepth: 1
	});
	if (result.leaves.length !== 2 || result.leaves.some((p) => p.polygon.length !== 4)) return;
	const points = new Map<string, kern.Vec>(),
		children: Child[] = [];
	const center = cellId(x + 1, y + 1);
	for (const parcel of result.leaves) {
		// The two original corners identify the end of the leaf opposite its cut.
		const corner = (v: kern.Vec) => polygon.findIndex((p) => p[0] === v[0] && p[1] === v[1]);
		const end = parcel.polygon.findIndex(
			(v, i) => corner(v) >= 0 && corner(parcel.polygon[(i + 1) % 4]) >= 0
		);
		if (end < 0) return;
		const [a, b, seamB, seamA] = Array.from({ length: 4 }, (_, i) => parcel.polygon[(end + i) % 4]);
		const i = corner(a),
			left = face.ring[i],
			right = face.ring[(i + 1) % 4];
		const mid = average(left, right),
			lo = average(face.ring[(i + 3) % 4], left),
			hi = average(right, face.ring[(i + 2) % 4]);
		points.set(mid, kern.mix(a, b, 0.5));
		points.set(lo, seamA);
		points.set(hi, seamB);
		if (!points.has(center)) points.set(center, kern.mix(seamA, seamB, 0.5));
		children.push(
			{ ring: [left, mid, center, lo], parcel: parcel.id },
			{ ring: [right, hi, center, mid], parcel: parcel.id }
		);
	}
	return { points, children };
}

/** Publish accepted leaf boundaries before neighbors are subdivided so both own the same seam. */
export function courtParcels(
	graph: Graph,
	width: number,
	height: number,
	seed: number,
	profile: Lattice['profile'],
	enabled: boolean
) {
	const points = new Map<string, kern.Vec>(),
		blocks = new Map<string, Child[]>();
	if (enabled)
		for (const face of graph.faces.values()) {
			const [x, y] = coord(face.id);
			if (face.ring.length !== 4 || x === 0 || y === 0 || x + 2 >= width || y + 2 >= height)
				continue;
			if (face.ring.some((v, i) => points.has(average(v, face.ring[(i + 1) % 4])))) continue;
			const cut = divide(face, graph, seed, profile);
			if (!cut) continue;
			for (const [id, p] of cut.points) points.set(id, p);
			blocks.set(face.id, cut.children);
		}
	return { points, blocks };
}
