import { defaults } from '../../../config/city-volume-projection';
import type { Shape } from '../../core/object';
import type { Vec3 } from '../../core/geometry';

type Triangle = [number, number, number];
type Mesh = Extract<Shape, { kind: 'mesh' }>;

const barycentricTolerance = defaults.cityAnchorBarycentricTolerance;

function triangleWeights(positions: readonly number[], [a, b, c]: Triangle, x: number, y: number) {
	const ux = positions[3 * b] - positions[3 * a];
	const uy = positions[3 * b + 1] - positions[3 * a + 1];
	const vx = positions[3 * c] - positions[3 * a];
	const vy = positions[3 * c + 1] - positions[3 * a + 1];
	const px = x - positions[3 * a];
	const py = y - positions[3 * a + 1];
	const area = ux * vy - uy * vx;
	if (area === 0) return;
	const u = (px * vy - py * vx) / area;
	const v = (ux * py - uy * px) / area;
	const weights = [1 - u - v, u, v];
	if (weights.every((weight) => weight >= -barycentricTolerance)) return weights;
}

const bucketM = defaults.cityAnchorBucketM;

function* buckets(positions: readonly number[], triangle: Triangle) {
	const xs = triangle.map((i) => Math.floor(positions[3 * i] / bucketM));
	const ys = triangle.map((i) => Math.floor(positions[3 * i + 1] / bucketM));
	for (let x = Math.min(...xs); x <= Math.max(...xs); x++)
		for (let y = Math.min(...ys); y <= Math.max(...ys); y++) yield `${x}/${y}`;
}

/** Welds sampled contacts into an arbitrary terrain mesh. An interior contact adds a
 * three-face fan, and a contact on a shared edge splits both faces. */
export function pinGround(mesh: Mesh, anchors: readonly Vec3[]): Mesh {
	if (!anchors.length) return mesh;
	const positions = [...mesh.positions];
	const faces = new Set<Triangle>();
	const bins = new Map<string, Set<Triangle>>();

	function index(triangle: Triangle) {
		faces.add(triangle);
		for (const key of buckets(positions, triangle)) {
			const existing = bins.get(key);
			if (existing) existing.add(triangle);
			else bins.set(key, new Set([triangle]));
		}
	}

	for (let i = 0; i < mesh.indices.length; i += 3)
		index([mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]]);

	for (const [x, y, z] of anchors) {
		const key = `${Math.floor(x / bucketM)}/${Math.floor(y / bucketM)}`;
		const candidates = [...(bins.get(key) ?? [])];
		let inserted: number | undefined;
		for (const triangle of candidates) {
			const weights = triangleWeights(positions, triangle, x, y);
			if (!weights) continue;
			const vertex = weights.findIndex((weight) => weight >= 1 - barycentricTolerance);
			if (vertex !== -1) {
				inserted = triangle[vertex];
				positions[3 * inserted + 2] = z;
				continue;
			}
			if (inserted === undefined) {
				inserted = positions.length / 3;
				positions.push(x, y, z);
			}
			faces.delete(triangle);
			for (const old of buckets(positions, triangle)) bins.get(old)?.delete(triangle);
			const anchor = inserted;
			for (const [side, a] of triangle.entries()) {
				if (weights[(side + 2) % 3] <= barycentricTolerance) continue;
				index([a, triangle[(side + 1) % 3], anchor]);
			}
		}
		if (inserted === undefined) throw new RangeError('Ground anchor falls outside the terrain');
	}
	return { kind: 'mesh', positions, indices: [...faces].flat() };
}
