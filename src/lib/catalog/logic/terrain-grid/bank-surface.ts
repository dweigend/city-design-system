import type { Vec3 } from '../parametrik/types';
import type { TerrainCell } from './types';

type Corners = TerrainCell['corners'];

/** Interpolates a chart point on the two terrain triangles, split from corner zero to two. */
export function chartPoint([a, b, c, d]: Corners, u: number, v: number): Vec3 {
	const p = u >= v ? b : d;
	const weight = Math.abs(u - v),
		diagonal = Math.min(u, v);
	const at = (i: number) => a[i] + weight * (p[i] - a[i]) + diagonal * (c[i] - a[i]);
	return [at(0), at(1), at(2)];
}

/** Interpolates the refined surface on the same chart triangles used by rendering and picking. */
export function bankHeight(cell: TerrainCell, x: number, y: number) {
	const bank = cell.bank;
	if (!bank) return -Infinity;
	const [a, b, c, d] = cell.corners;
	const dx = x - a[0],
		dy = y - a[1];
	const first = (c[0] - a[0]) * dy - (c[1] - a[1]) * dx <= 0;
	const p = first ? b : d;
	const ux = p[0] - a[0],
		uy = p[1] - a[1],
		vx = c[0] - a[0],
		vy = c[1] - a[1];
	const det = ux * vy - uy * vx;
	const side = (dx * vy - dy * vx) / det,
		diagonal = (ux * dy - uy * dx) / det;
	const n = bank.divisions;
	const bound = (t: number) => Math.max(0, Math.min(n, n * t));
	const u = bound(diagonal + (first ? side : 0)),
		v = bound(diagonal + (first ? 0 : side));
	const i = Math.min(n - 1, Math.floor(u)),
		j = Math.min(n - 1, Math.floor(v));
	const k = j * (n + 1) + i,
		points = bank.points;
	return chartPoint(
		[points[k], points[k + 1], points[k + n + 2], points[k + n + 1]],
		u - i,
		v - j
	)[2];
}
