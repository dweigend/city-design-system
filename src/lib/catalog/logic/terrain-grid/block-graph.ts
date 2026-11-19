import { kern } from '../parametrik/raster/universal';
import { hash } from '../hash-random';
import { required } from '../required';
import { cellId } from './types';
import { MODULE, type Lattice } from './contour-rows';
type Address = readonly [number, number];
export type Face = { id: string; ring: string[]; slots: string[] };
export const coord = (id: string): Address => {
	const [c, r] = id.split('/').map(Number);
	return [c, r];
};
export const corners = (x: number, y: number, size: number) => [
	cellId(x, y),
	cellId(x + size, y),
	cellId(x + size, y + size),
	cellId(x, y + size)
];
export const average = (a: string, b: string) => {
	const [x, y] = coord(a),
		[u, v] = coord(b);
	return cellId((x + u) / 2, (y + v) / 2);
};
export const get = (map: ReadonlyMap<string, kern.Vec>, id: string) =>
	required(map.get(id), 'block vertex');

function paired(left: Face, right: Face, positions: Map<string, kern.Vec>, seed: number) {
	const [a, b, e, f] = left.ring,
		[, g, h] = right.ring;
	const west = [
			[a, b, f],
			[b, g, h, e, f]
		],
		east = [
			[a, b, h, e, f],
			[b, g, h]
		];
	const choices = hash(seed, ...coord(left.id)) > 0.5 ? [west, east] : [east, west];
	for (const rings of choices) {
		if (
			!rings.every((ring) =>
				ring.every(
					(v, i) =>
						kern.orient(
							get(positions, v),
							get(positions, ring[(i + 1) % ring.length]),
							get(positions, ring[(i + 2) % ring.length])
						) > 0
				)
			)
		)
			continue;
		const intent = sourceIntent(seed, positions);
		try {
			if (
				!rings.every(
					(ring, i) =>
						kern.deriveChunk(intent, { id: String(i), ring, level: 0 }).topology.faces.size ===
						ring.length
				)
			)
				continue;
		} catch (e) {
			if (e instanceof kern.InvariantError && e.code === 'quality-unattainable') continue;
			throw e;
		}
		left.ring = rings[0];
		right.ring = rings[1];
		return;
	}
}

// Cut a four-module run with both frontages intact. These normalized cuts
// are affine coordinates for all strips with the same topology.
const depthCuts = ([0.5, 0.4, 0.6] as const).map((firstCut) => {
	const polygon: kern.Vec[] = [
		[0, 0],
		[2, 0],
		[2, 4],
		[0, 4]
	];
	const fronts: kern.Front[] = [1, 3].map((i) => ({
		id: String(i),
		a: polygon[i],
		b: polygon[(i + 1) % 4],
		width: 1,
		level: 0,
		kind: 'alley'
	}));
	const cut = kern.parcelize('strip', polygon, fronts, {
		maxArea: 5,
		minArea: 3,
		minWidth: 1,
		minFront: 1,
		maxDepth: 1,
		level: 0,
		firstCut
	});
	return Math.max(...cut.leaves[0].polygon.map((p) => p[1])) - 2;
});
function courtVertex(
	c: number,
	r: number,
	width: number,
	seed: number,
	profile: Lattice['profile'],
	interior: boolean
): kern.Vec {
	const drift = (channel: number, limit = profile.stagger) =>
		interior ? (hash(seed, c + r * (width + 1), channel) * 2 - 1) * limit : 0;
	// Alternate the cut axis in neighbouring four-module courts.
	const transverse = (Math.floor(c / 4) + Math.floor(r / 4) + seed) % 2 === 0;
	const cut = interior ? depthCuts[Math.floor(hash(seed, c, r) * depthCuts.length)] : 0;
	return [
		(c +
			drift(1, Math.min(profile.stagger, profile.frontageShift)) +
			(transverse && c % 4 === 2 ? cut : 0)) *
			MODULE,
		(r + drift(2) + (!transverse && r % 4 === 2 ? cut : 0)) * MODULE
	];
}
/** Build a shared graph of terrace frontages before subdividing its faces. */
export function sourceGraph(
	width: number,
	height: number,
	seed: number,
	profile: Lattice['profile'],
	settled: boolean,
	exchanges: boolean
) {
	const positions = new Map<string, kern.Vec>(),
		faces = new Map<string, Face>();
	for (let r = 0; r <= height; r += 2)
		for (let c = 0; c <= width; c += 2) {
			const interior = settled && Math.min(c, width - c, r, height - r) > 0;
			positions.set(cellId(c, r), courtVertex(c, r, width, seed, profile, interior));
			if (c < width && r < height)
				faces.set(cellId(c, r), {
					id: cellId(c, r),
					ring: corners(c, r, 2),
					slots: corners(c, r, 1)
				});
		}
	if (settled && exchanges) pairInterior(width, height, faces, positions, seed);
	return { positions, faces };
}

function pairInterior(
	width: number,
	height: number,
	faces: Map<string, Face>,
	positions: Map<string, kern.Vec>,
	seed: number
) {
	for (let r = 2; r + 2 < height; r += 2)
		for (let c = 2; c + 4 < width; c += 4) {
			paired(
				required(faces.get(cellId(c, r)), 'west block'),
				required(faces.get(cellId(c + 2, r)), 'east block'),
				positions,
				seed
			);
		}
}

export function sourceIntent(seed: number, positions: Map<string, kern.Vec>): kern.Intent {
	return {
		version: 1,
		seed,
		positions,
		faces: new Map(),
		fixed: new Set(),
		semantics: new Map(),
		limits: kern.defaultLimits
	};
}
