import { distance, type Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { defineParams, resolveParams } from '../../core/params';
import { Random } from '../../core/random';
import { carrier, edgeId, type Node, type Quad } from './carrier';
import { meetsQuality, quality } from './metrics';
import { insideOutline } from './outline';
import { contourBearing, siteOutline, type HeightAt, type Site } from './site';

/** Fixed datum and bearing with either a simple world-XY outline or full rectangle dimensions
 * in meters. An outline closes implicitly and accepts either winding. Rectangle cornerCut trims
 * each corner by that fraction of both edges (0 to 0.5). Grow by enclosing the previous site. */
export type TerrainGridSite = Site;

/** Supported nominal cell size in meters. */
export const terrainGridParams = defineParams({
	cellSize: { label: 'Cell size', unit: 'm', default: 40, min: 5, max: 80, step: 5 }
});

/** Immutable quality limits in plan (radians and ratio) and grade limit (rise/run). */
export { quality as terrainGridQuality } from './metrics';

/** Addressed vertex with sampled position, in meters with Z up. */
export type TerrainGridVertex = Readonly<{ id: string; position: Vec3 }>;

/** Counterclockwise vertex IDs. Neighbor i is across edge i→(i+1) mod 4, or null at the boundary. */
export type TerrainGridCell = Readonly<{
	id: string;
	vertexIds: Quad<string>;
	neighbors: Quad<string | null>;
}>;

/** Detached, deeply frozen cells, incident vertices, and oriented boundary edges with land to the left. */
export type TerrainGrid = Readonly<{
	cells: readonly TerrainGridCell[];
	vertices: readonly TerrainGridVertex[];
	boundary: readonly (readonly [from: string, to: string])[];
}>;

/** Pure height sampler in meters. Return undefined to exclude unavailable ground, such as water.
 * The datum and its 10 m XY probes require finite heights. */
export type TerrainGridOptions = Readonly<{
	seed: number;
	site: TerrainGridSite;
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

type MutableQuad<T> = [T, T, T, T];

function topology(
	candidates: readonly { id: string; corners: Quad<Node> }[],
	height: (node: Node) => number | undefined
): TerrainGrid {
	const vertices = new Map<string, TerrainGridVertex>();
	const open = new Map<
		string,
		{ id: string; from: string; to: string; neighbors: MutableQuad<string | null>; index: number }
	>();
	const cells = candidates.map(({ id, corners }) => {
		const [a, b, c, d] = corners.map(({ id }) => id);
		const vertexIds = Object.freeze([a, b, c, d] as const);
		const neighbors: MutableQuad<string | null> = [null, null, null, null];
		corners.forEach((node, index) => {
			if (!vertices.has(node.id)) {
				const position = Object.freeze([
					...node.xy,
					required(height(node), 'accepted vertex height')
				] as const);
				vertices.set(node.id, Object.freeze({ id: node.id, position }));
			}
			const from = node.id;
			const to = vertexIds[(index + 1) % 4];
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

/** Derives a ground grid from a site, uint32 seed and pure sampler. Invalid sites (non-positive
 * extents or extents over 2 km), seed, parameter types and missing sampler fail before sampling.
 * Cell size clamps and snaps through the schema. Non-finite sampled heights throw.
 *
 * Seeded mutual triangle pairs form rhombi on a locally relaxed carrier. It splits faces at their centers and edge midpoints.
 * Base lattice addresses and split paths own identity. Increasing the crop about the same
 * datum leaves all existing vertices, cells and old neighbor relationships intact.
 *
 * The primary carrier axis follows the contour measured on 20 m baselines at the datum.
 * Below 1.5% grade it follows the site's bearing. Cells must lie wholly inside the site,
 * be strictly convex in XY with angles of at least 30° and a longest-to-shortest edge ratio
 * of at most 2.1. Samples along sides and both diagonals, at most 1 m apart, reject rises
 * steeper than 20% or absent ground. Narrow features between samples may go undetected.
 */
function create({ site, seed, heightAt, parameters }: TerrainGridOptions): TerrainGrid {
	const outline = siteOutline(site);
	if (typeof heightAt !== 'function') throw new TypeError('Expected a ground height sampler');
	if (!Number.isInteger(seed) || seed < 0 || seed >= 2 ** 32)
		throw new RangeError('Invalid terrain grid seed');
	const { cellSize } = resolveParams(terrainGridParams, parameters);
	const ground = samples(heightAt);
	ground.datumHeight(...site.origin);
	const bearing = contourBearing(site, ground.datumHeight);
	const includes = insideOutline(outline);
	const accepted = [];
	for (const cell of carrier(site, outline, bearing, cellSize, Random.create({ seed }))) {
		const [a, b, c, d] = cell.corners;
		const plan = [a.xy, b.xy, c.xy, d.xy] as const;
		if (!meetsQuality(plan) || !includes(plan)) continue;
		const segments = [
			[a, b],
			[b, c],
			[c, d],
			[d, a],
			[a, c],
			[b, d]
		];
		if (!segments.every(([from, to]) => ground.validEdge(from, to))) continue;
		accepted.push(cell);
	}
	return topology(accepted, ground.height);
}

/** Factory for an immutable terrain grid. */
export const TerrainGrid = Object.freeze({ create });
