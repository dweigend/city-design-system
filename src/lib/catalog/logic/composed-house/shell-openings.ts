import type { HouseComposition } from '../house-typology';
import { interpolatePoint, type Vec3 } from '../parametrik/types';

type Opening = NonNullable<HouseComposition['exterior']>['openings'][number];
type Mesh = { points: Vec3[]; triangles: number[] };
const axes = [0, 1, 2] as const;

const planes = axes.flatMap((axis) => [
	[axis, 1],
	[axis, -1]
]);
function misses(points: Vec3[], box: Opening) {
	return axes.some(
		(k) => points.every((p) => p[k] < box.min[k]) || points.every((p) => p[k] > box.max[k])
	);
}

function split(face: Vec3[], axis: number, edge: number, side: number) {
	const inside: Vec3[] = [],
		outside: Vec3[] = [];
	for (const [i, a] of face.entries()) {
		const b = face[(i + 1) % face.length];
		const da = side * (a[axis] - edge),
			db = side * (b[axis] - edge);
		if (da >= 0) inside.push(a);
		if (da <= 0) outside.push(a);
		if (da * db < 0) {
			const cut = interpolatePoint(a, b, da / (da - db));
			cut[axis] = edge;
			inside.push(cut);
			outside.push(cut);
		}
	}
	return { inside, outside };
}

function subtract(face: Vec3[], box: Opening) {
	if (misses(face, box)) return [face];
	const kept: Vec3[][] = [];
	let rest = face;
	for (const [k, sign] of planes) {
		const edge = sign > 0 ? box.min[k] : box.max[k];
		if (rest.every((p) => sign * (p[k] - edge) >= 0)) continue;
		const { inside, outside } = split(rest, k, edge, sign);
		if (outside.length >= 3) kept.push(outside);
		rest = inside;
		if (rest.length < 3) break;
	}
	return kept;
}

/** Cuts the swept walking volumes from the fitted world-space mesh, including folds and courtyard returns. */
export function openSurface(mesh: Mesh, box: Opening): Mesh {
	if (misses(mesh.points, box)) return mesh;
	const points: Vec3[] = [],
		triangles: number[] = [];
	const indices = new Map<Vec3, number>();
	function vertex(p: Vec3) {
		const existing = indices.get(p);
		if (existing !== undefined) return existing;
		const index = points.push(p) - 1;
		indices.set(p, index);
		return index;
	}
	for (let i = 0; i < mesh.triangles.length; i += 3) {
		const face = mesh.triangles.slice(i, i + 3).map((j) => mesh.points[j]);
		for (const polygon of subtract(face, box)) {
			const corners = polygon.map(vertex);
			for (let j = 2; j < corners.length; j++)
				triangles.push(corners[0], corners[j - 1], corners[j]);
		}
	}
	return { points, triangles };
}

/** Trims carrier centrelines against the opening expanded by the pipe radius. */
export function openRod(segment: [Vec3, Vec3], box: Opening, radius: number): [Vec3, Vec3][] {
	const [a, b] = segment;
	let enter = 0,
		leave = 1;
	for (const k of axes) {
		const lo = box.min[k] - radius,
			hi = box.max[k] + radius,
			delta = b[k] - a[k];
		if (delta === 0) {
			if (a[k] < lo || a[k] > hi) return [segment];
			continue;
		}
		const t = (lo - a[k]) / delta,
			u = (hi - a[k]) / delta;
		enter = Math.max(enter, Math.min(t, u));
		leave = Math.min(leave, Math.max(t, u));
	}
	if (leave <= enter) return [segment];
	const kept: [Vec3, Vec3][] = [];
	if (enter > 0) kept.push([a, interpolatePoint(a, b, enter)]);
	if (leave < 1) kept.push([interpolatePoint(a, b, leave), b]);
	return kept;
}
