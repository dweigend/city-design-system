import { distance, measurePolygon, type Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { defineParams, resolveParams } from '../../core/params';
import { Random } from '../../core/random';
import { carrier, edgeId, freeQuad, type Candidate, type Carrier, type Node } from './carrier';
import { meetsQuality, quality } from './metrics';
import { insideOutline } from './outline';
import { bands, contour, hex, polar, square, triangle } from './regular';
import { shoreline, usableShoreRing } from './shore';
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
	/** Optional ground elevation for fitting the reference frame when its datum is unavailable
	 * for building. The datum and its 10 m probes still require finite heights. */
	referenceHeightAt?: (x: number, y: number) => number;
	/** Optional grade limit over whole cell chords. Water and unavailable ground are still
	 * sampled at the edge spacing. With no cell-wide limit the default grade applies per interval. */
	maximumCellGrade?: number;
	/** Optional total rise over the accepted cell's sampled ground, in meters. When supplied,
	 * it replaces the default point grade test. */
	maximumCellRise?: number;
	/** Maximum span between dry-ground probes on an edge or chord, 1 m by default. */
	edgeSampleStep?: number;
	/** Optional signed clearance from a buildable shoreline in meters. Crossing cells are
	 * trimmed to one dry polygon before validating its ground. */
	shore?: Readonly<{
		clearanceAt: (x: number, y: number) => number;
		minimumEdge: number;
		minimumArea: number;
	}>;
	/** Optional predicate checked at the centroid and across each polygon at the given
	 * maximum spacing in meters, in addition to the default edge and chord checks. */
	surface?: Readonly<{ sampleStep: number; accepts: (x: number, y: number) => boolean }>;
}>;

function samples(
	heightAt: TerrainGridOptions['heightAt'],
	maximumCellGrade: number | undefined,
	maximumCellRise: number | undefined,
	edgeSampleStep: number,
	referenceHeightAt: TerrainGridOptions['referenceHeightAt']
) {
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
		const end = height(b);
		if (previous === undefined || end === undefined) return false;
		const length = distance(a.xy, b.xy);
		if (maximumCellGrade !== undefined && Math.abs(end - previous) > maximumCellGrade * length)
			return false;
		const steps = Math.max(1, Math.ceil(length / edgeSampleStep));
		const maxRise =
			maximumCellGrade === undefined && maximumCellRise === undefined
				? (quality.maximumGrade * length) / steps
				: Infinity;
		for (let index = 1; index <= steps; index++) {
			const t = index / steps;
			const z =
				index === steps
					? end
					: read(a.xy[0] + t * (b.xy[0] - a.xy[0]), a.xy[1] + t * (b.xy[1] - a.xy[1]));
			if (z === undefined || Math.abs(z - previous) > maxRise) return false;
			previous = z;
		}
		return true;
	}

	return {
		height,
		read,
		datumHeight: ((x, y) => {
			const z = referenceHeightAt ? referenceHeightAt(x, y) : read(x, y);
			if (z === undefined || !Number.isFinite(z))
				throw new RangeError('Terrain grid datum has no finite ground');
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
 * sampled at up to 1 m spacing by default reject unavailable ground. Grade defaults to 20% at each
 * interval, or can be limited over whole chords or as a sampled cell height range. Organic and
 * free quads also enforce the published angle and edge-ratio limits. Invalid inputs throw. */
function create({
	site,
	seed,
	heightAt,
	parameters,
	variant = 'organic',
	maximumCellGrade,
	maximumCellRise,
	edgeSampleStep = quality.maximumSampleStep,
	shore,
	surface,
	referenceHeightAt
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
	if (
		maximumCellGrade !== undefined &&
		(!Number.isFinite(maximumCellGrade) || maximumCellGrade < 0)
	)
		throw new RangeError('Expected a nonnegative finite cell grade limit');
	if (maximumCellRise !== undefined && (!Number.isFinite(maximumCellRise) || maximumCellRise < 0))
		throw new RangeError('Expected a nonnegative finite cell rise limit');
	if (surface && (!Number.isFinite(surface.sampleStep) || surface.sampleStep <= 0))
		throw new RangeError('Expected a positive finite surface sample spacing');
	if (!(Number.isFinite(edgeSampleStep) && edgeSampleStep > 0))
		throw new RangeError('Expected a positive finite edge sample spacing');
	const ground = samples(
		heightAt,
		maximumCellGrade,
		maximumCellRise,
		edgeSampleStep,
		referenceHeightAt
	);
	ground.datumHeight(...site.origin);
	const bearing = contourBearing(site, ground.datumHeight);
	const includes = insideOutline(outline);
	const accepted = [];
	const clip = shore && shoreline(shore.clearanceAt);
	for (const source of generate(site, outline, bearing, cellSize, Random.create({ seed }))) {
		const plan = source.corners.map(({ xy }) => xy);
		if (plan.length < 3 || (checkQuality && !meetsQuality(plan)) || !includes(plan)) continue;
		const corners = clip ? clip(source.corners) : source.corners;
		if (corners.length < 3) continue;
		if (
			shore &&
			corners.some((corner, index) => corner !== source.corners[index]) &&
			!usableShoreRing(corners, shore)
		)
			continue;
		const cell = { id: source.id, corners };
		if (
			!cell.corners.every((from, i) =>
				cell.corners.slice(i + 1).every((to) => ground.validEdge(from, to))
			)
		)
			continue;
		if (surface || maximumCellRise !== undefined) {
			let low = Infinity;
			let high = -Infinity;
			if (
				!validSurface(corners, surface?.sampleStep ?? edgeSampleStep, (x, y) => {
					if (maximumCellRise === undefined) return surface?.accepts(x, y) ?? true;
					const z = ground.read(x, y);
					if (z === undefined || (surface && !surface.accepts(x, y))) return false;
					low = Math.min(low, z);
					high = Math.max(high, z);
					return high - low <= maximumCellRise;
				})
			)
				continue;
		}
		accepted.push(cell);
	}
	return topology(accepted, ground.height);
}

/** Checks a convex ring on a triangular sampling mesh. */
function validSurface(
	[a, ...ring]: readonly Node[],
	sampleStep: number,
	accepts: NonNullable<TerrainGridOptions['surface']>['accepts']
) {
	const { centroid } = measurePolygon([a, ...ring].map(({ xy }) => xy));
	if (!centroid || !accepts(...centroid)) return false;
	for (let i = 1; i < ring.length; i++) {
		const b = ring[i - 1].xy;
		const c = ring[i].xy;
		const splits = Math.max(
			1,
			Math.ceil(Math.max(distance(a.xy, b), distance(b, c), distance(c, a.xy)) / sampleStep)
		);
		for (let u = 0; u <= splits; u++) {
			for (let v = 0; u + v <= splits; v++) {
				const x = a.xy[0] + ((b[0] - a.xy[0]) * u + (c[0] - a.xy[0]) * v) / splits;
				const y = a.xy[1] + ((b[1] - a.xy[1]) * u + (c[1] - a.xy[1]) * v) / splits;
				if (!accepts(x, y)) return false;
			}
		}
	}
	return true;
}

/** Takes plan cells in the requested order, rebuilding neighbor and boundary references. */
function select(grid: TerrainGrid, ids: readonly string[]): TerrainGrid {
	const byId = new Map(grid.cells.map((cell) => [cell.id, cell]));
	const selected = new Set(ids);
	const vertices = new Set<string>();
	const boundary: (readonly [string, string])[] = [];
	const cells = ids.map((id) => {
		const cell = required(byId.get(id), 'selected plan cell');
		const neighbors = cell.neighbors.map((neighbor, index) => {
			const from = cell.vertexIds[index];
			vertices.add(from);
			if (neighbor !== null && selected.has(neighbor)) return neighbor;
			boundary.push(
				Object.freeze([from, cell.vertexIds[(index + 1) % cell.vertexIds.length]] as const)
			);
			return null;
		});
		return Object.freeze({ ...cell, neighbors: Object.freeze(neighbors) });
	});
	return Object.freeze({
		cells: Object.freeze(cells),
		vertices: Object.freeze(grid.vertices.filter(({ id }) => vertices.has(id))),
		boundary: Object.freeze(boundary)
	});
}

/** Factory and selection of immutable terrain grids. */
export const TerrainGrid = Object.freeze({ create, select });
