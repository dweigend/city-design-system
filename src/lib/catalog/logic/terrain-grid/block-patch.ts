import { hash } from '../hash-random';
import { kern } from '../parametrik/raster/universal';
import { required } from '../required';
import { BLOCK, MODULE, type Lattice } from './contour-rows';
import { settlementExtent } from './alley-plan';
import { cellId } from './types';

type Address = readonly [number, number];
const quad = <T>(at: (side: number) => T): [T, T, T, T] => [at(0), at(1), at(2), at(3)];
const ringAt = (c: number, r: number) => [
	cellId(c, r),
	cellId(c + 1, r),
	cellId(c + 1, r + 1),
	cellId(c, r + 1)
];

// Exchange a shared side for a diagonal of its six-sided union. The middle
// vertices become three-way junctions and the diagonal ends become five-way junctions.
function exchange(faces: Map<string, kern.SourceFace>, c: number, r: number, reverse: boolean) {
	const [a, b, e, f] = ringAt(c, r),
		[, g, h] = ringAt(c + 1, r);
	const left = reverse ? [a, b, g, f] : [a, h, e, f];
	const right = reverse ? [g, h, e, f] : [a, b, g, h];
	for (const [i, ring] of [left, right].entries()) {
		const id = cellId(c + i, r);
		faces.set(id, { id, ring, level: 0 });
	}
}

function exchangeInterior(
	faces: Map<string, kern.SourceFace>,
	width: number,
	height: number,
	seed: number,
	spacing: number
) {
	for (let r = 2; r + 1 < height; r += Math.max(3, Math.round(spacing)))
		for (let c = 2; c + 2 < width - 1; c += 4) {
			const start = c + Number(hash(seed, c + r * width, 2) > 0.5 && c + 3 < width - 1);
			exchange(faces, start, r, hash(seed, c + r * width, 3) > 0.5);
		}
}

type Ground = (c: number, r: number) => kern.Vec;
function parcelVertex(
	c: number,
	r: number,
	width: number,
	height: number,
	seed: number,
	profile: Lattice['profile'],
	ground: Ground,
	settled: boolean
) {
	const [x, y] = ground(c, r);
	if (!settled || c <= 1 || c === width || r === 0 || r === height)
		return { position: [x, y] as const, fixed: true };
	const shift = (hash(seed, c + r * width, 5) * 2 - 1) * profile.frontageShift;
	const [nearX, nearY] = ground(c + Math.sign(shift), r);
	const fixed = r % profile.terraceRows === 1 || r % profile.terraceRows === 0;
	const jitter = (channel: number) =>
		MODULE * profile.stagger * (2 * hash(seed, r * (width + 1) + c, channel) - 1);
	return {
		position: [
			x + Math.abs(shift) * (nearX - x) + jitter(0),
			y + Math.abs(shift) * (nearY - y) + jitter(1)
		] as const,
		fixed
	};
}

function blockIntent(
	width: number,
	height: number,
	seed: number,
	profile: Lattice['profile'],
	ground: Ground,
	settled: boolean
) {
	const faces = new Map<string, kern.SourceFace>(),
		positions = new Map<string, kern.Vec>(),
		fixed = new Set<string>();
	for (let r = 0; r <= height; r++)
		for (let c = 0; c <= width; c++) {
			const id = cellId(c, r);
			const vertex = parcelVertex(c, r, width, height, seed, profile, ground, settled);
			positions.set(id, vertex.position);
			if (vertex.fixed) fixed.add(id);
			if (c < width && r < height) faces.set(id, { id, ring: ringAt(c, r), level: 0 });
		}
	if (settled) exchangeInterior(faces, width, height, seed, profile.terraceRows);
	return {
		version: 1 as const,
		seed,
		positions,
		faces,
		fixed,
		semantics: new Map(),
		limits: kern.defaultLimits
	};
}

function admissible(intent: kern.Intent, positions: kern.Intent['positions'], minArea: number) {
	const limits = { ...intent.limits, minArea };
	return [...intent.faces.values()].every((face) =>
		kern.acceptable(
			kern.quadQuality(face.ring.map((v) => required(positions.get(v), 'relaxed corner'))),
			limits
		)
	);
}

function fitPatch(
	width: number,
	height: number,
	seed: number,
	profile: Lattice['profile'],
	ground: Ground,
	settled: boolean
) {
	const intent = blockIntent(width, height, seed, profile, ground, settled);
	const relaxed = kern.relax(intent, settled ? profile.relaxPasses : 0).positions;
	if (admissible(intent, relaxed, profile.minParcelArea)) return { intent, positions: relaxed };
	// A sharp bend can invalidate a diagonal. Retain the displaced frontage and
	// recover the block with its original incidences, backing off only as far as necessary.
	for (const face of intent.faces.values()) {
		const [c, r] = face.id.split('/').map(Number);
		face.ring = ringAt(c, r);
	}
	const candidate = kern.relax(intent, profile.relaxPasses).positions;
	const base = new Map(
		[...candidate.keys()].map((id) => {
			const [c, r] = id.split('/').map(Number);
			return [id, ground(c, r)] as const;
		})
	);
	for (let share = 1; share >= 1 / 64; share /= 2) {
		const positions = new Map(
			[...candidate].map(([id, p]) => [
				id,
				kern.mix(required(base.get(id), 'base corner'), p, share)
			])
		);
		if (admissible(intent, positions, profile.minParcelArea)) return { intent, positions };
	}
	return { intent, positions: base };
}

function makePatch(
	width: number,
	height: number,
	seed: number,
	profile: Lattice['profile'],
	ground: Ground,
	settled: boolean
) {
	const { intent, positions } = fitPatch(width, height, seed, profile, ground, settled);
	const topology = kern.buildTopology([...intent.faces.values()]);
	const address = (id: string): Address => {
		const [c, r] = id.split('/').map(Number);
		return [c, r];
	};
	const faces = new Map(
		[...intent.faces].map(([id, face]) => {
			let edge = required(topology.faces.get(id), 'parcel face').edge;
			const neighbors = quad(() => {
				const side = required(topology.edges.get(edge), 'parcel side');
				edge = side.next;
				return side.twin
					? address(required(topology.edges.get(side.twin), 'parcel twin').face)
					: undefined;
			});
			return [id, { vertices: quad((i) => address(face.ring[i])), neighbors }];
		})
	);
	return { positions, faces };
}

/** Fits the Universal kernel's relaxed patches inside fixed alley bands, including partial rim blocks. */
export function blockPatches(lattice: Lattice, ground: Ground) {
	const patches = new Map<string, ReturnType<typeof makePatch>>();
	return (c: number, r: number) => {
		const x = Math.floor(Math.min(c, lattice.columns - 1) / BLOCK.columns) * BLOCK.columns;
		const y = Math.floor(Math.min(r, lattice.rows - 1) / BLOCK.rows) * BLOCK.rows;
		const key = cellId(x, y);
		let patch = patches.get(key);
		if (!patch) {
			patch = makePatch(
				Math.min(BLOCK.columns, lattice.columns - x),
				Math.min(BLOCK.rows, lattice.rows - y),
				Math.floor(hash(lattice.terrain.seed, y * lattice.columns + x, 0) * 0xffffffff),
				lattice.profile,
				(c, r) => ground(x + c, y + r),
				settlementExtent(
					lattice.terrain,
					x + BLOCK.columns / 2,
					y + BLOCK.rows / 2,
					lattice.profile
				) > 0
			);
			patches.set(key, patch);
		}
		return { patch, x, y, id: cellId(c - x, r - y) };
	};
}
