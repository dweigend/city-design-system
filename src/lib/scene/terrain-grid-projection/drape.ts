import type { Vec2, Vec3 } from '../../core/geometry';
import type { Shape } from '../../core/object';

type Triangle = readonly [Vec3, Vec3, Vec3];

const epsilon = 1e-9;

function* buckets(points: readonly Vec2[] | readonly Vec3[], bucketSize: number) {
	const xs = points.map(([x]) => Math.floor(x / bucketSize));
	const ys = points.map(([, y]) => Math.floor(y / bucketSize));
	for (let x = Math.min(...xs); x <= Math.max(...xs); x++) {
		for (let y = Math.min(...ys); y <= Math.max(...ys); y++) yield `${x},${y}`;
	}
}

function weights([x, y]: Vec2, [a, b, c]: Triangle) {
	const bx = b[0] - a[0];
	const by = b[1] - a[1];
	const cx = c[0] - a[0];
	const cy = c[1] - a[1];
	const area = bx * cy - by * cx;
	const u = ((x - a[0]) * cy - (y - a[1]) * cx) / area;
	const v = (bx * (y - a[1]) - by * (x - a[0])) / area;
	return [1 - u - v, u, v];
}

function clip(start: number[], end: number[]) {
	let from = 0;
	let to = 1;
	for (let index = 0; index < 3; index++) {
		const a = start[index];
		const b = end[index];
		if (a < -epsilon && b < -epsilon) return;
		if (a < -epsilon) from = Math.max(from, a / (a - b));
		if (b < -epsilon) to = Math.min(to, a / (a - b));
	}
	if (to - from > epsilon) return [from, to];
}

export function drape({ positions, indices }: Extract<Shape, { kind: 'mesh' }>, bucketSize = 16) {
	if (!(Number.isFinite(bucketSize) && bucketSize > 0))
		throw new RangeError('Expected a positive triangle bucket size');
	const points: Vec3[] = [];
	for (let i = 0; i < positions.length; i += 3)
		points.push([positions[i], positions[i + 1], positions[i + 2]]);
	const triangles = new Map<string, Triangle[]>();
	for (let i = 0; i < indices.length; i += 3) {
		const [a, b, c] = [points[indices[i]], points[indices[i + 1]], points[indices[i + 2]]];
		if ((b[0] - a[0]) * (c[1] - a[1]) === (b[1] - a[1]) * (c[0] - a[0])) continue;
		const triangle: Triangle = [a, b, c];
		for (const key of buckets(triangle, bucketSize)) {
			const bin = triangles.get(key);
			if (bin) bin.push(triangle);
			else triangles.set(key, [triangle]);
		}
	}
	return (a: Vec2, b: Vec2): Vec3[] => {
		const candidates = new Set<Triangle>();
		for (const key of buckets([a, b], bucketSize))
			for (const triangle of triangles.get(key) ?? []) candidates.add(triangle);
		const cuts: { t: number; z: number }[] = [];
		for (const triangle of candidates) {
			const start = weights(a, triangle);
			const end = weights(b, triangle);
			for (const t of clip(start, end) ?? []) {
				const z = triangle.reduce(
					(z, point, i) => z + point[2] * (start[i] + t * (end[i] - start[i])),
					0
				);
				cuts.push({ t, z });
			}
		}
		cuts.sort((a, b) => a.t - b.t);
		if (!cuts.length || cuts[0].t > epsilon || cuts[cuts.length - 1].t < 1 - epsilon)
			throw new RangeError('Grid edge falls outside the terrain mesh');
		return cuts
			.filter(({ t }, index) => index === 0 || t - cuts[index - 1].t > epsilon)
			.map(({ t, z }) => [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), z]);
	};
}
