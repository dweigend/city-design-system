import { crossProduct, type Vec3 } from '../parametrik/types';

type Offset = readonly [number, number];
const delta = (p: Vec3, q: Vec3): Vec3 => [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
function unit(v: Vec3): Vec3 {
	const d = Math.hypot(...v);
	if (d < 1e-12) throw new RangeError('A sweep station needs a tangent');
	return [v[0] / d, v[1] / d, v[2] / d];
}

/** Transports a closed cross-section along sampled 3D stations. The first lateral
 * axis points left in plan (along y for a vertical path). Returns open-ended skin. */
export function sweepProfile(
	path: readonly Vec3[],
	profile: readonly Offset[],
	closedProfile = true
) {
	const rings: Vec3[][] = [];
	const closed = path.length > 2 && Math.hypot(...delta(path[0], path[path.length - 1])) < 1e-10;
	for (const [i, p] of path.entries()) {
		const before = i === 0 && closed ? path.length - 2 : Math.max(0, i - 1);
		const after = i === path.length - 1 && closed ? 1 : Math.min(path.length - 1, i + 1);
		const direction = delta(path[before], path[after]);
		const tangent = unit(Math.hypot(...direction) > 1e-12 ? direction : delta(p, path[after]));
		const normal = crossProduct([0, 0, 1], tangent);
		const left = unit(Math.hypot(...normal) > 1e-10 ? normal : crossProduct(tangent, [1, 0, 0]));
		const up = crossProduct(tangent, left);
		rings.push(
			profile.map(([side, height]) => p.map((v, k) => v + left[k] * side + up[k] * height) as Vec3)
		);
	}
	return connectSections(rings, false, closedProfile);
}

/** Closed solid between two or more surveyed cross-sections. Profiles are
 * counter-clockwise viewed along the negative path tangent and must be convex. A repeated
 * end section closes a circuit onto its original vertices without a cap. */
export function profileSolid(rings: readonly Vec3[][]) {
	const last = rings[rings.length - 1];
	const loop =
		rings.length > 3 && rings[0].every((p, i) => Math.hypot(...delta(p, last[i])) < 1e-9);
	const mesh = connectSections(rings, !loop, true);
	if (loop) {
		mesh.points.splice(-last.length);
		mesh.triangles = mesh.triangles.map((i) => i % mesh.points.length);
	}
	return { kind: 'mesh' as const, ...mesh, lines: [] };
}
function connectSections(rings: readonly Vec3[][], cap: boolean, closedProfile: boolean) {
	const n = rings[0].length,
		points = rings.flat(),
		triangles: number[] = [];
	for (let i = 1; i < rings.length; i++)
		for (let j = 0; j < (closedProfile ? n : n - 1); j++) {
			const a = (i - 1) * n + j,
				b = (i - 1) * n + ((j + 1) % n);
			triangles.push(a, b, b + n, a, b + n, a + n);
		}
	const end = points.length - n;
	if (cap) for (let i = 1; i < n - 1; i++) triangles.push(0, i + 1, i, end, end + i, end + i + 1);
	return { points, triangles };
}
