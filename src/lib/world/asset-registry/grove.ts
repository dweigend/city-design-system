import { triangulateD, TriangulateResult } from 'clipper2-ts';
import { defaults } from '../../../config/grove';
import {
	bounds,
	distance,
	isSimplePolygon,
	measurePointSegmentDistance,
	measurePolygon,
	size,
	type Vec2,
	type Vec3
} from '../../core/geometry';
import { mesh, createMeshObject, type MeshShape } from '../../core/mesh';
import { defineParams } from '../../core/params';
import { createPolygonIndex } from '../../core/polygon-index';
import { Random } from '../../core/random';
import type { AssetEntry } from '../../core/asset-registry';
import type { CityAssetHost } from './hosts';

export const { groveLawnLiftM } = defaults;

const [minDensity, maxDensity, density, densityStep] = defaults.groveDensityBand;
const [minHeight, maxHeight, height, heightStep] = defaults.groveHeightBandM;
const params = defineParams({
	density: {
		label: 'Density',
		unit: 'trees / 1000 m²',
		min: minDensity,
		max: maxDensity,
		default: density,
		step: densityStep
	},
	height: {
		label: 'Tree height',
		unit: 'm',
		min: minHeight,
		max: maxHeight,
		default: height,
		step: heightStep
	}
});

type GroveSite = Readonly<{
	outline: readonly Vec2[];
	holes?: readonly (readonly Vec2[])[];
	groundAt: (point: Vec2) => number;
}>;

function readSite(host: CityAssetHost): GroveSite {
	if (host.kind !== 'parcel') throw new RangeError('Expected a grove parcel');
	const { parcel } = host;
	if ('groundAt' in host) return { ...host.parcel, groundAt: host.groundAt, holes: host.holes };
	if ('site' in host)
		return {
			outline: host.parcel.outline,
			groundAt: host.site.groundAt ?? (() => host.site.datumZ)
		};
	if (!('corners' in parcel)) throw new RangeError('Expected an addressed grove parcel');
	return {
		outline: parcel.corners.map(({ position }) => position),
		groundAt: () => parcel.baseZ
	};
}

function validateSite({ outline, holes = [] }: GroveSite) {
	if (!isSimplePolygon(outline, holes))
		throw new RangeError('Grove boundaries must form simple rings with disjoint interior holes');
}

type LawnTriangle = readonly [Vec3, Vec3, Vec3];

function lawn(site: GroveSite): Readonly<{ shape: MeshShape; triangles: readonly LawnTriangle[] }> {
	const contours = [site.outline, ...(site.holes ?? [])];
	const { solution, result } = triangulateD(
		contours.map((ring) => ring.map(([x, y]) => ({ x, y }))),
		defaults.groveLawnPrecision
	);
	if (result !== TriangulateResult.success) throw new RangeError('Cannot triangulate grove lawn');
	const positions: number[] = [];
	const indices: number[] = [];
	const triangles: LawnTriangle[] = [];
	// Exact arithmetic: XYZ triples and independent triangulated faces.
	for (const triangle of solution) {
		const ring = triangle.map(({ x, y }): Vec2 => [x, y]);
		if (measurePolygon(ring).area < 0) ring.reverse();
		const vertices = ring.map(([x, y]): Vec3 => [x, y, site.groundAt([x, y]) + groveLawnLiftM]);
		triangles.push([vertices[0], vertices[1], vertices[2]]);
		for (const [x, y, z] of vertices) {
			indices.push(positions.length / 3);
			positions.push(x, y, z);
		}
	}
	return { shape: { kind: 'mesh', positions, indices }, triangles };
}

function readLawnElevation(
	triangles: readonly LawnTriangle[],
	[x, y]: Vec2,
	fallback: number
): number {
	let bestMargin = -Infinity;
	let bestElevation = fallback;
	for (const [[ax, ay, az], [bx, by, bz], [cx, cy, cz]] of triangles) {
		const twiceArea = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
		if (twiceArea <= 0) continue;
		const u = ((bx - x) * (cy - y) - (by - y) * (cx - x)) / twiceArea;
		const v = ((cx - x) * (ay - y) - (cy - y) * (ax - x)) / twiceArea;
		const w = 1 - u - v;
		const margin = Math.min(u, v, w);
		if (margin > bestMargin) {
			bestMargin = margin;
			bestElevation = u * az + v * bz + w * cz;
			if (margin >= 0) return bestElevation;
		}
	}
	return bestElevation;
}

type Tree = Readonly<{ at: Vec2; radius: number; height: number; pointed: boolean }>;

/** Reads the seeded tree centres, canopy radii and heights on the plan, in meters. */
export function readGrovePlan(
	site: Pick<GroveSite, 'outline' | 'holes'>,
	{ density, height }: Readonly<{ density: number; height: number }>,
	seed: number
): readonly Tree[] {
	const { outline, holes = [] } = site;
	const extent = bounds(
		outline.map(([x, y]): Vec3 => [
			x,
			y,
			/* Exact arithmetic: lift XY points to the zero plane for bounds. */ 0
		])
	);
	if (!extent) return [];
	const [width, depth] = size(extent);
	const area =
		Math.abs(measurePolygon(outline).area) -
		holes.reduce((total, ring) => total + Math.abs(measurePolygon(ring).area), 0);
	if (area <= 0) return [];
	const areaRatio = area / defaults.groveReferenceAreaM2;
	const [minimum, maximum] = defaults.groveTreeCount;
	const densityArea = Math.max(area, defaults.groveMinimumDensityAreaM2);
	const count = Math.min(
		maximum,
		Math.max(minimum, Math.round(density * (densityArea / defaults.groveReferenceAreaM2)))
	);
	const targetHeight = height * Math.min(1, Math.sqrt(areaRatio));
	const index = createPolygonIndex(
		[
			{ id: 'lawn', outline },
			...holes.map((ring, i) => ({ id: 'hole/' + i, outline: ring }))
		].reverse()
	);
	const edges = [outline, ...holes].flatMap((ring) =>
		ring.map((point, i) => [point, ring[(i + 1) % ring.length]] as const)
	);
	const random = Random.create({ seed });
	const trees: Tree[] = [];
	const [short, tall] = defaults.groveHeightVariationRatio;
	const [narrow, wide] = defaults.groveCanopyRadiusRatio;
	for (let i = 0; i < count; i++) {
		const tree = random.derive(String(i));
		const height = targetHeight * tree.number({ min: short, max: tall });
		const radius = height * tree.number({ min: narrow, max: wide });
		const pointed = tree.sample(['pointed', 'rounded'])[0] === 'pointed';
		for (let attempt = 0; attempt < defaults.grovePlantingAttempts; attempt++) {
			const at: Vec2 = [
				extent.min[0] + tree.number() * width,
				extent.min[1] + tree.number() * depth
			];
			if (index.readPoint(at)?.outline !== outline) continue;
			if (edges.some(([a, b]) => measurePointSegmentDistance(at, a, b) < radius)) continue;
			if (
				trees.some(
					(other) => distance(at, other.at) < (other.radius + radius) * defaults.groveSpacingRatio
				)
			)
				continue;
			trees.push({ at, radius, height, pointed });
			break;
		}
	}
	return trees;
}

/** A square cone or octahedron, with its bottom vertex at the top of the trunk. */
function crown(
	{ at: [x, y], radius: r, height, pointed }: Tree,
	base: number,
	trunk: number
): MeshShape {
	// Exact arithmetic: the octahedron's widest ring is halfway up the crown.
	const middle = pointed ? trunk : (trunk + base + height) / 2;
	return {
		kind: 'mesh',
		positions: [
			x + r,
			y,
			middle,
			x,
			y + r,
			middle,
			x - r,
			y,
			middle,
			x,
			y - r,
			middle,
			x,
			y,
			base + height,
			x,
			y,
			trunk
		],
		// Exact arithmetic: four outward faces per apex, indices refer to the vertices above.
		indices: /* Exact arithmetic: square bipyramid topology. */ [
			0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4, 1, 0, 5, 2, 1, 5, 3, 2, 5, 0, 3, 5
		]
	};
}

export const groveAsset: AssetEntry<CityAssetHost> = {
	id: 'park/grove',
	kind: 'park',
	tags: ['forest', 'landscape'],
	params,
	hostKinds: ['parcel'],
	validateHost(host) {
		validateSite(readSite(host));
	},
	build(host, { density, height }, seed) {
		const site = readSite(host);
		const layers = { lawn: mesh(), trunk: mesh(), canopy: mesh() };
		const surface = lawn(site);
		layers.lawn.append(surface.shape);
		for (const tree of readGrovePlan(site, { density, height }, seed)) {
			const base = readLawnElevation(
				surface.triangles,
				tree.at,
				site.groundAt(tree.at) + groveLawnLiftM
			);
			const trunk = base + tree.height * defaults.groveCanopyBaseRatio;
			const [x, y] = tree.at;
			layers.trunk.pier(
				[x, y, base - groveLawnLiftM],
				trunk,
				tree.height * defaults.groveTrunkRadiusRatio
			);
			layers.canopy.append(crown(tree, base, trunk));
		}
		return createMeshObject('park/grove', layers, []);
	}
};
