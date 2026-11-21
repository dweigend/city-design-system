import type { QuadCell } from './carrier';
import type { Vec3 } from '../parametrik/types';

/** Barycentric tolerance for stations on a terrain triangle's shared edge. */
const EDGE_TOLERANCE = 1e-8;

function triangleHeight(x: number, y: number, a: Vec3, b: Vec3, c: Vec3, within = false) {
	const dx = x - a[0],
		dy = y - a[1],
		ux = b[0] - a[0],
		uy = b[1] - a[1],
		vx = c[0] - a[0],
		vy = c[1] - a[1];
	const det = ux * vy - uy * vx,
		u = (dx * vy - dy * vx) / det,
		v = (ux * dy - uy * dx) / det;
	if (within && !(u >= -EDGE_TOLERANCE && v >= -EDGE_TOLERANCE && u + v <= 1 + EDGE_TOLERANCE))
		return NaN;
	return a[2] + u * (b[2] - a[2]) + v * (c[2] - a[2]);
}

/** Interpolates a surveyed quad on its rendered diagonal. */
export function surfaceHeight(corners: readonly Vec3[], x: number, y: number) {
	const [a, b, c, d] = corners;
	return (c[0] - a[0]) * (y - a[1]) - (c[1] - a[1]) * (x - a[0]) <= 0
		? triangleHeight(x, y, a, b, c)
		: triangleHeight(x, y, a, c, d);
}

/** Samples the containing cell's terrain in metres, or the nearest cell centre off the parcel. */
export function parcelSurfaceHeight(cells: readonly QuadCell[], x: number, y: number) {
	for (const cell of cells) {
		const [a, b, c, d] = cell.corners;
		const first = triangleHeight(x, y, a, b, c, true);
		if (Number.isFinite(first)) return first;
		const second = triangleHeight(x, y, a, c, d, true);
		if (Number.isFinite(second)) return second;
	}
	return cells.reduce((a, b) =>
		Math.hypot(a.center[0] - x, a.center[1] - y) < Math.hypot(b.center[0] - x, b.center[1] - y)
			? a
			: b
	).center[2];
}
