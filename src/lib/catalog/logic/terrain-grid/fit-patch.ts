import { fitBlocks } from './fit-block';
import { kern } from '../parametrik/raster/universal';
import { required } from '../required';
import { MODULE, type Lattice } from './contour-rows';
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

/** Project and quality-check one isolated choice of cuts. */
export function fitPatch(
	width: number,
	height: number,
	seed: number,
	lattice: Lattice,
	ground: Ground,
	settled: boolean,
	allowed: ReadonlySet<string>,
	template?: Template
) {
	const profile = lattice.profile;
	const plain = () => regularChart(width, height, lattice);
	const proposal =
		template ??
		(settled
			? qualityFallback(() => blockTemplate(width, height, seed, profile, true, true, allowed))
			: undefined) ??
		plain();
	const projectVertex = (p: kern.Vec) => project(p, width, height, ground);
	const projectCorner = (chart: Template, id: string): kern.Vec => {
		const point = (key: string) =>
			projectVertex(required(chart.positions.get(key), 'chart vertex'));
		const seam = chart.seams.get(id);
		return seam ? kern.mix(point(seam[0]), point(seam[1]), 0.5) : point(id);
	};
	const positions = new Map(
		[...proposal.positions.keys()].map((id) => [id, projectCorner(proposal, id)])
	);
	const regular = () => {
		let value = regularTemplates.get(proposal);
		if (!value) {
			value = blockTemplate(width, height, seed, profile, settled, false, allowed);
			regularTemplates.set(proposal, value);
		}
		return value;
	};
	let fitted = qualityFallback(() =>
		fitBlocks(proposal, positions, profile.minParcelArea, regular, projectCorner)
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
	return { positions, faces, candidates: fitted.candidates, template: proposal };
}

export type FittedPatch = ReturnType<typeof fitPatch>;
