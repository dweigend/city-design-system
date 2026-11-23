import { distance, type Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { defineParams, resolveParams } from '../../core/params';
import { Random } from '../../core/random';
import { carrier, edgeId, freeQuad, type Candidate, type Carrier, type Node } from './carrier';
import { meetsQuality, quality } from './metrics';
import { insideOutline } from './outline';
import { bands, contour, hex, polar, square, triangle } from './regular';
import { voronoi } from './voronoi';
import { contourBearing, siteOutline, type HeightAt, type Site } from './site';

/** Fixed datum and bearing with either a simple world-XY outline or full rectangle dimensions
 * in meters. An outline closes implicitly and accepts either winding. Rectangle cornerCut trims
 * each corner by that fraction of both edges (0 to 0.5). Grow by enclosing the previous site. */
export type TerrainGridSite = Site;

/** Supported nominal cell size in meters. */
export const terrainGridParams = defineParams({
	cellSize: { label: 'Cell size', unit: 'm', default: 40, min: 5, max: 120, step: 5 }
});

/** Immutable quality limits in plan (radians and ratio) and grade limit (rise/run). */
export { quality as terrainGridQuality } from './metrics';

/** Addressed vertex with sampled position, in meters with Z up. */
export type TerrainGridVertex = Readonly<{ id: string; position: Vec3 }>;

/** Counterclockwise polygon. Neighbor i is across edge i→(i+1), or null at the boundary. */
export type TerrainGridCell = Readonly<{
	id: string;
	vertexIds: readonly string[];
	neighbors: readonly (string | null)[];
}>;

/** Detached, deeply frozen cells, incident vertices, and oriented boundary edges with land to the left. */
export type TerrainGrid = Readonly<{
	cells: readonly TerrainGridCell[];
	vertices: readonly TerrainGridVertex[];
	boundary: readonly (readonly [from: string, to: string])[];
}>;

/** Available plan families in display order. */
export const planVariants = [
	'organic',
	'square',
	'hex',
	'triangle',
	'bands',
	'contour',
	'polar',
	'voronoi',
	'free-quad'
] as const;

/** Plan topology selected before clipping and ground sampling. */
export type PlanVariant = (typeof planVariants)[number];

const carriers: Record<
	PlanVariant,
	{ generate: Carrier; checkQuality?: boolean; defaultSize?: number }
> = {
	organic: {
		generate: carrier,
		checkQuality: true,
		defaultSize: terrainGridParams.cellSize.default
	},
	square: { generate: square },
	hex: { generate: hex },
	triangle: { generate: triangle },
	bands: { generate: bands },
	contour: { generate: contour },
	polar: { generate: polar },
	voronoi: { generate: voronoi },
	'free-quad': { generate: freeQuad, checkQuality: true }
};

/** Equivalent square side of the mean cell at cell size 1, per plan family, measured on a flat
 * 1.2 km crop. Divide a target side in meters by it to get the cell size of a family. Polar
 * cells widen with their ring, so polar keeps 1. */
export const planCellSide: Readonly<Record<PlanVariant, number>> = Object.freeze({
	organic: 0.927,
	square: 1,
	hex: 1.612,
	triangle: 0.658,
	bands: 1,
	contour: 1,
	polar: 1,
	voronoi: 1,
	'free-quad': 0.927
});

/** Pure height sampler in meters. Return undefined to exclude unavailable ground, such as water.
 * The datum and its 10 m XY probes require finite heights. */
export type TerrainGridOptions = Readonly<{
	seed: number;
	site: TerrainGridSite;
	variant?: PlanVariant;
	heightAt: (x: number, y: number) => number | undefined;
	parameters?: Readonly<{ cellSize?: number }>;
}>;

function samples(heightAt: TerrainGridOptions['heightAt']) {
	const heights = new Map<string, number | undefined>();
	const edges = new Map<string, boolean>();
	const height = (node: Node) => {
		if (!heights.has(node.id)) heights.set(node.id, read(...node.xy));
		return heights.get(node.id);
	};

	function read(x: number, y: number) {
		const z = heightAt(x, y);
		if (z !== undefined && !Number.isFinite(z)) throw new RangeError('Invalid ground height');
		return z;
	}

	function validSegment(a: Node, b: Node) {
		let previous = height(a);
		if (previous === undefined) return false;
		const length = distance(a.xy, b.xy);
		const steps = Math.ceil(length / quality.maximumSampleStep);
		const maxRise = (quality.maximumGrade * length) / steps;
		for (let index = 1; index <= steps; index++) {
			const t = index / steps;
			const z =
				index === steps
					? height(b)
					: read(a.xy[0] + t * (b.xy[0] - a.xy[0]), a.xy[1] + t * (b.xy[1] - a.xy[1]));
			if (z === undefined || Math.abs(z - previous) > maxRise) return false;
			previous = z;
		}
		return true;
	}

	return {
		height,
		datumHeight: ((x, y) => {
			const z = read(x, y);
			if (z === undefined) throw new RangeError('Terrain grid datum has no ground');
			return z;
		}) satisfies HeightAt,
		validEdge(a: Node, b: Node) {
			const key = edgeId(a.id, b.id);
			if (!edges.has(key)) edges.set(key, a.id < b.id ? validSegment(a, b) : validSegment(b, a));
			return edges.get(key);
		}
	};
}

function topology(
	candidates: readonly Candidate[],
	height: (node: Node) => number | undefined
): TerrainGrid {
	const vertices = new Map<string, TerrainGridVertex>();
	const open = new Map<
		string,
		{ id: string; from: string; to: string; neighbors: (string | null)[]; index: number }
	>();
	const cells = candidates.map(({ id, corners }) => {
		const vertexIds = Object.freeze(corners.map(({ id }) => id));
		const neighbors: (string | null)[] = corners.map(() => null);
		corners.forEach((node, index) => {
			if (!vertices.has(node.id)) {
				const position = Object.freeze([
					...node.xy,
					required(height(node), 'accepted vertex height')
				] as const);
				vertices.set(node.id, Object.freeze({ id: node.id, position }));
			}
			const from = node.id;
			const to = vertexIds[(index + 1) % vertexIds.length];
			const key = edgeId(from, to);
			const opposite = open.get(key);
			if (opposite) {
				neighbors[index] = opposite.id;
				opposite.neighbors[opposite.index] = id;
				open.delete(key);
			} else {
				open.set(key, { id, from, to, neighbors, index });
			}
		});
		return Object.freeze({ id, vertexIds, neighbors });
	});
	for (const cell of cells) Object.freeze(cell.neighbors);
	return Object.freeze({
		cells: Object.freeze(cells),
		vertices: Object.freeze([...vertices.values()]),
		boundary: Object.freeze(
			[...open.values()].map(({ from, to }) => Object.freeze([from, to] as const))
		)
	});
}

/** Derives a detached plan from a site, uint32 seed and pure sampler. The default organic
 * variant uses relaxed, split quads. Fixed addresses retain vertices and cells as the crop
 * grows around the same datum. Cells must fit wholly inside the crop. Edges and diagonals
 * sampled at up to 1 m spacing reject unavailable ground or grades over 20%. Organic and
 * free quads also enforce the published angle and edge-ratio limits. Invalid inputs throw. */
function create({
	site,
	seed,
	heightAt,
	parameters,
	variant = 'organic'
}: TerrainGridOptions): TerrainGrid {
	if (!Object.hasOwn(carriers, variant)) throw new RangeError('Unknown plan grid variant');
	const { generate, checkQuality, defaultSize = 15 } = carriers[variant];
	const outline = siteOutline(site);
	if (typeof heightAt !== 'function') throw new TypeError('Expected a ground height sampler');
	if (!Number.isInteger(seed) || seed < 0 || seed >= 2 ** 32)
		throw new RangeError('Invalid terrain grid seed');
	const { cellSize } = resolveParams(terrainGridParams, {
		cellSize: parameters?.cellSize ?? defaultSize
	});
	const ground = samples(heightAt);
	ground.datumHeight(...site.origin);
	const bearing = contourBearing(site, ground.datumHeight);
	const includes = insideOutline(outline);
	const accepted = [];
	for (const cell of generate(site, outline, bearing, cellSize, Random.create({ seed }))) {
		const plan = cell.corners.map(({ xy }) => xy);
		if (plan.length < 3 || (checkQuality && !meetsQuality(plan)) || !includes(plan)) continue;
		if (
			!cell.corners.every((from, i) =>
				cell.corners.slice(i + 1).every((to) => ground.validEdge(from, to))
			)
		)
			continue;
		accepted.push(cell);
	}
	return topology(accepted, ground.height);
}

/** Factory for an immutable terrain grid. */
export const TerrainGrid = Object.freeze({ create });
