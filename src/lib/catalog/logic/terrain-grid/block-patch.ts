import { fitBlocks } from './fit-block';
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

function qualityFallback<T>(derive: () => T) {
	try {
		return derive();
	} catch (error) {
		if (error instanceof kern.InvariantError && error.code === 'quality-unattainable')
			return undefined;
		throw error;
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

// Profiles are retained only for the lifetime of a world and its edit history.
const emptyTemplates = new WeakMap<Lattice['profile'], Map<string, Template>>();
function regularChart(width: number, height: number, lattice: Lattice) {
	const charts = emptyTemplates.get(lattice.profile) ?? new Map<string, Template>();
	emptyTemplates.set(lattice.profile, charts);
	const key = lattice.terrain.seed + ':' + cellId(width, height);
	let chart = charts.get(key);
	if (!chart) {
		chart = blockTemplate(width, height, lattice.terrain.seed, lattice.profile, false);
		charts.set(key, chart);
	}
	return chart;
}

function makePatch(
	width: number,
	height: number,
	seed: number,
	profile: Lattice['profile'],
	ground: Ground,
	settled: boolean,
	plain: () => Template,
	template?: Template
) {
	const proposal =
		template ??
		(settled
			? qualityFallback(() => blockTemplate(width, height, seed, profile, true))
			: undefined) ??
		plain();
	const projectVertex = (p: kern.Vec) => project(p, width, height, ground);
	const positions = new Map([...proposal.positions].map(([id, p]) => [id, projectVertex(p)]));
	const regular = () => {
		let value = regularTemplates.get(proposal);
		if (!value) {
			value = blockTemplate(width, height, seed, profile, settled, false);
			regularTemplates.set(proposal, value);
		}
		return value;
	};
	let fitted = qualityFallback(() =>
		fitBlocks(proposal, positions, profile.minParcelArea, regular, projectVertex)
	);
	if (!fitted) {
		fitted = plain();
		for (const [id, p] of fitted.positions) positions.set(id, projectVertex(p));
	}
	let faces = faceCache.get(fitted);
	if (!faces) {
		faces = parcelTopology(fitted);
		faceCache.set(fitted, faces);
	}
	return { positions, faces, template: proposal };
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
					() => regularChart(width, height, lattice),
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
