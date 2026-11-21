import type { Vec3 } from '../parametrik/types';

function triangleHeight(x: number, y: number, a: Vec3, b: Vec3, c: Vec3) {
	const dx = x - a[0],
		dy = y - a[1],
		ux = b[0] - a[0],
		uy = b[1] - a[1],
		vx = c[0] - a[0],
		vy = c[1] - a[1];
	const det = ux * vy - uy * vx,
		u = (dx * vy - dy * vx) / det,
		v = (ux * dy - uy * dx) / det;
	return a[2] + u * (b[2] - a[2]) + v * (c[2] - a[2]);
}

/** Interpolates a surveyed quad on its rendered diagonal. */
export function surfaceHeight(corners: readonly Vec3[], x: number, y: number) {
	const [a, b, c, d] = corners;
	return (c[0] - a[0]) * (y - a[1]) - (c[1] - a[1]) * (x - a[0]) <= 0
		? triangleHeight(x, y, a, b, c)
		: triangleHeight(x, y, a, c, d);
}
