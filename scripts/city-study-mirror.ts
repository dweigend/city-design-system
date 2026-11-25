import type { Vec2 } from '../src/lib/core/geometry';
import type { TerrainGrid } from '../src/lib/domain/terrain-grid';
import { polygon } from './city-study-plan';
import { mirrorFootprintBucketM, mirrorProbeSpacingM } from './config/city-study';

/** Matched lowland towns use the terrain study's unit-runoff seed list. */
export const mirrorSeeds = [
	1201, 1301, 1409, 7, 42, 314, 2718, 9001, 65535, 424242, 31337, 8086
] as const;
/** At most half of the median town's built samples should have a reflected built counterpart. */
export const maximumMedianMirrorShare = 0.5;

const stepM = mirrorProbeSpacingM;
const bucketM = mirrorFootprintBucketM;

function footprint(grid: TerrainGrid) {
	const ring = polygon(grid);
	const buckets = new Map<string, Vec2[][]>();
	for (const { vertexIds } of grid.cells) {
		const points = ring(vertexIds);
		const xs = points.map(([x]) => Math.floor(x / bucketM));
		const ys = points.map(([, y]) => Math.floor(y / bucketM));
		for (let x = Math.min(...xs); x <= Math.max(...xs); x++) {
			for (let y = Math.min(...ys); y <= Math.max(...ys); y++) {
				const key = `${x},${y}`;
				const list = buckets.get(key) ?? [];
				list.push(points);
				buckets.set(key, list);
			}
		}
	}
	return ([x, y]: Vec2) =>
		(buckets.get(`${Math.floor(x / bucketM)},${Math.floor(y / bucketM)}`) ?? []).some((ring) =>
			ring.every(([a, b], i) => {
				const [u, v] = ring[(i + 1) % ring.length];
				return (u - a) * (y - b) - (v - b) * (x - a) >= -1e-6;
			})
		);
}

function reflector(xy: readonly number[]) {
	const segments: { x: number; y: number; dx: number; dy: number; length2: number }[] = [];
	for (let i = 2; i < xy.length; i += 2) {
		const x = xy[i - 2],
			y = xy[i - 1],
			dx = xy[i] - x,
			dy = xy[i + 1] - y;
		if (dx || dy) segments.push({ x, y, dx, dy, length2: dx * dx + dy * dy });
	}
	return ([x, y]: Vec2): Vec2 => {
		let cx = x,
			cy = y,
			nearest = Infinity;
		for (const segment of segments) {
			const { x: a, y: b, dx, dy, length2 } = segment;
			const along = Math.max(0, Math.min(1, ((x - a) * dx + (y - b) * dy) / length2));
			const u = a + along * dx,
				v = b + along * dy;
			const d = (x - u) ** 2 + (y - v) ** 2;
			if (d >= nearest) continue;
			nearest = d;
			cx = u;
			cy = v;
		}
		return [2 * cx - x, 2 * cy - y];
	};
}

/** Share of occupied 24 m samples whose reflection across the nearest trunk segment is occupied. */
export function footprintMirrorShare(grid: TerrainGrid, trunkXY: readonly number[]) {
	if (!grid.cells.length) return 0;
	const contains = footprint(grid);
	const reflect = reflector(trunkXY);
	const xs = grid.vertices.map(({ position: [x] }) => x);
	const ys = grid.vertices.map(({ position: [, y] }) => y);
	const x0 = Math.ceil(Math.min(...xs) / stepM) * stepM;
	const y0 = Math.ceil(Math.min(...ys) / stepM) * stepM;
	const x1 = Math.max(...xs);
	const y1 = Math.max(...ys);
	let occupied = 0;
	let mirrored = 0;
	for (let x = x0; x <= x1; x += stepM) {
		for (let y = y0; y <= y1; y += stepM) {
			if (!contains([x, y])) continue;
			occupied++;
			mirrored += Number(contains(reflect([x, y])));
		}
	}
	return mirrored / Math.max(1, occupied);
}
