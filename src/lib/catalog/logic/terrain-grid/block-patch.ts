import { hash } from '../hash-random';
import { kern } from '../parametrik/raster/universal';
import { required } from '../required';
import { BLOCK, MODULE, type Lattice } from './contour-rows';
import { settlementExtent } from './alley-plan';
import { cellId } from './types';

import { blockTemplate, type Address, type Ground } from './block-faces';
function project(p: kern.Vec, width: number, height: number, ground: Ground): kern.Vec {
	const u = Math.max(0, Math.min(width, p[0] / MODULE)),
		v = Math.max(0, Math.min(height, p[1] / MODULE));
	const c = Math.min(Math.floor(u), width - 1),
		r = Math.min(Math.floor(v), height - 1);
	if (Number.isInteger(u) && Number.isInteger(v)) return ground(u, v);
	return kern.mix(
		kern.mix(ground(c, r), ground(c + 1, r), u - c),
		kern.mix(ground(c, r + 1), ground(c + 1, r + 1), u - c),
		v - r
	);
}

type Template = ReturnType<typeof blockTemplate>;
const regularTemplates = new WeakMap<Template, Template>();

function fitBlocks(
	template: Template,
	positions: Map<string, kern.Vec>,
	minArea: number,
	regular: () => Template,
	projectVertex: (p: kern.Vec) => kern.Vec
) {
	const limits = { ...kern.defaultLimits, minArea };
	const groups = new Set<string>();
	for (const [id, face] of template.faces) {
		const points = face.ring.map((v) => required(positions.get(v), 'projected corner'));
		if (!kern.acceptable(kern.quadQuality(points), limits))
			groups.add(required(template.parents.get(id), 'block').group);
	}
	if (!groups.size) return template;
	// A concave source can cross the two proposal groups that supplied its ears.
	const affectedParents = new Set(
		[...template.parents.values()].filter((p) => groups.has(p.group)).map((p) => p.id)
	);
	for (const parent of template.parents.values())
		if (affectedParents.has(parent.id)) groups.add(parent.group);
	const fallback = regular(),
		faces = new Map(template.faces),
		parents = new Map(template.parents);
	for (const [id, block] of fallback.parents) {
		if (!groups.has(block.group)) continue;
		const face = required(fallback.faces.get(id), 'replacement parcel');
		parents.set(id, block);
		faces.set(id, face);
		for (const v of face.ring)
			positions.set(v, projectVertex(required(fallback.positions.get(v), 'replacement corner')));
	}
	repairCenters(faces, parents, groups, positions, limits);
	return { ...template, faces, parents };
}

function repairCenters(
	faces: Template['faces'],
	parents: Template['parents'],
	groups: Set<string>,
	positions: Map<string, kern.Vec>,
	limits: kern.Limits
) {
	const blocks = new Set([...parents.values()].filter((p) => groups.has(p.group)).map((p) => p.id));
	for (const id of blocks) {
		const [x, y] = id.split('/').map(Number),
			center = cellId(x + 1, y + 1);
		const children = [...faces.values()].filter((f) => parents.get(f.id)?.id === id);
		const corners = [
			[x, y],
			[x + 2, y],
			[x + 2, y + 2],
			[x, y + 2]
		].map(([c, r]) => required(positions.get(cellId(c, r)), 'block boundary'));
		const original = required(positions.get(center), 'block center');
		const attempts = corners
			.flatMap((corner, i) => [corner, kern.mix(corner, corners[(i + 1) % 4], 0.5)])
			.flatMap((p) => [1 / 32, 1 / 16, 1 / 8, 1 / 4].map((share) => kern.mix(original, p, share)));
		if (
			!kern.fitQuadCenter(positions, center, children, corners, limits, [
				original,
				...attempts,
				original
			])
		)
			throw new kern.InvariantError('quality-unattainable', [id]);
	}
}

function parcelTopology(fitted: Template) {
	const topology = kern.buildTopology([...fitted.faces.values()]);
	const address = (id: string): Address => {
		const [c, r] = id.split('/').map(Number);
		return [c, r];
	};
	const faces = new Map(
		[...fitted.faces].map(([id, face]) => {
			let edge = required(topology.faces.get(id), 'parcel face').edge;
			const neighbors = face.ring.map(() => {
				const side = required(topology.edges.get(edge), 'parcel side');
				edge = side.next;
				return side.twin
					? address(required(topology.edges.get(side.twin), 'parcel twin').face)
					: undefined;
			});
			return [
				id,
				{
					vertices: face.ring.map(address),
					neighbors,
					block: required(fitted.parents.get(id), 'source block')
				}
			];
		})
	);
	return faces;
}
const faceCache = new WeakMap<Template, ReturnType<typeof parcelTopology>>();

// Beyond the settlement only the dimensions of the partial rim affect the chart.
const emptyTemplates = new Map<string, Template>();
function templateFor(
	width: number,
	height: number,
	seed: number,
	profile: Lattice['profile'],
	settled: boolean
) {
	if (settled) return blockTemplate(width, height, seed, profile, true);
	const key = cellId(width, height);
	let result = emptyTemplates.get(key);
	if (!result) {
		result = blockTemplate(width, height, seed, profile, false);
		emptyTemplates.set(key, result);
	}
	return result;
}

function makePatch(
	width: number,
	height: number,
	seed: number,
	profile: Lattice['profile'],
	ground: Ground,
	settled: boolean,
	template = templateFor(width, height, seed, profile, settled)
) {
	const projectVertex = (p: kern.Vec) => project(p, width, height, ground);
	const positions = new Map([...template.positions].map(([id, p]) => [id, projectVertex(p)]));
	const regular = () => {
		let value = regularTemplates.get(template);
		if (!value) {
			value = blockTemplate(width, height, seed, profile, settled, false);
			regularTemplates.set(template, value);
		}
		return value;
	};
	const fitted = fitBlocks(template, positions, profile.minParcelArea, regular, projectVertex);
	let faces = faceCache.get(fitted);
	if (!faces) {
		faces = parcelTopology(fitted);
		faceCache.set(fitted, faces);
	}
	return { positions, faces, template };
}

type CachedBlock = { patch: ReturnType<typeof makePatch> };
export type BlockCache = Map<string, CachedBlock>;

/** Fits the Universal kernel's relaxed patches inside fixed alley bands, including partial rim blocks. */
export function blockPatches(
	lattice: Lattice,
	ground: Ground,
	cache: BlockCache,
	unchanged: (x: number, y: number, width: number, height: number) => boolean
) {
	const patches = new Map<string, { patch: ReturnType<typeof makePatch>; reused: boolean }>();
	return (c: number, r: number) => {
		const x = Math.floor(Math.min(c, lattice.columns - 1) / BLOCK.columns) * BLOCK.columns;
		const y = Math.floor(Math.min(r, lattice.rows - 1) / BLOCK.rows) * BLOCK.rows;
		const key = cellId(x, y);
		let entry = patches.get(key);
		if (!entry) {
			const width = Math.min(BLOCK.columns, lattice.columns - x);
			const height = Math.min(BLOCK.rows, lattice.rows - y);

			const old = cache.get(key);
			if (old && unchanged(x, y, width, height)) {
				entry = { patch: old.patch, reused: true };
			} else {
				const points = Array.from({ length: (width + 1) * (height + 1) }, (_, i) =>
					ground(x + (i % (width + 1)), y + Math.floor(i / (width + 1)))
				);
				const patch = makePatch(
					width,
					height,
					Math.floor(hash(lattice.terrain.seed, y * lattice.columns + x, 0) * 0xffffffff),
					lattice.profile,
					(c, r) => points[r * (width + 1) + c],
					settlementExtent(
						lattice.terrain,
						x + BLOCK.columns / 2,
						y + BLOCK.rows / 2,
						lattice.profile
					) > 0,
					old?.patch.template
				);
				cache.set(key, { patch });
				entry = { patch, reused: false };
			}
			patches.set(key, entry);
		}
		return { patch: entry.patch, reused: entry.reused, x, y, id: cellId(c - x, r - y) };
	};
}
