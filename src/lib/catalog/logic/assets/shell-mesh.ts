import type { Vec3 } from '../parametrik/types';

export type Mesh = { points: Vec3[]; triangles: number[]; lines: number[][] };
type UV = [number, number];
export const tau = 2 * Math.PI;
/** Appends a convex face with the supplied winding. */
export function face(m: Mesh, points: Vec3[]) {
	const k = m.points.length;
	m.points.push(...points);
	for (let j = 1; j < points.length - 1; j++) m.triangles.push(k, k + j, k + j + 1);
}
/** Sweeps a triangular member along a normalized elevation path. */
export function rod(m: Mesh, path: UV[], width: number, relief = 0.06) {
	for (let i = 1; i < path.length; i++) {
		const [u, v] = path[i - 1],
			[a, b] = path[i],
			length = Math.hypot(a - u, b - v);
		if (!length) continue;
		const x = (-(b - v) / length) * width,
			y = ((a - u) / length) * width;
		const ring = (s: number, t: number): Vec3[] => [
			[relief - 0.04, s - x, t - y],
			[relief + 0.05, s, t],
			[relief - 0.04, s + x, t + y]
		];
		const stations = Math.max(1, Math.ceil(Math.abs(v - b) * 8));
		let lo = ring(u, v);
		for (let k = 1; k <= stations; k++) {
			const t = k / stations;
			const hi = ring(u + t * (a - u), v + t * (b - v));
			for (let j = 0; j < 3; j++) face(m, [lo[j], lo[(j + 1) % 3], hi[(j + 1) % 3], hi[j]]);
			lo = hi;
		}
	}
}
/** Tessellates a continuous sheet, omitting the requested openings. */
export function fabric(
	m: Mesh,
	nx: number,
	nz: number,
	depth: (u: number, v: number) => number,
	skip?: (i: number, j: number) => boolean
) {
	for (let i = 0; i < nx; i++)
		for (let j = 0; j < nz; j++) {
			if (skip?.(i, j)) continue;
			const vertex = (a: number, b: number): Vec3 => [depth(a / nx, b / nz), a / nx, b / nz];
			face(m, [vertex(i, j), vertex(i + 1, j), vertex(i + 1, j + 1), vertex(i, j + 1)]);
		}
}
/** Samples a structural path at equal parameter intervals. */
export function curve(f: (t: number) => UV, n = 12) {
	return Array.from({ length: n + 1 }, (_, i) => f(i / n));
}
