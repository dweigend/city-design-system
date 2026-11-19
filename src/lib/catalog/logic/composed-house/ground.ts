import type { Vec3 } from '../parametrik/types';
import type { Section } from './types';
/** Interpolates the two ground triangles of the painted carrier at a station. */
export function terrainHeight(s: Section, [x, y]: Vec3) {
	for (const cell of s.cells) {
		const [a, b, c, d] = cell.corners;
		for (const [p, q] of [
			[b, c],
			[c, d]
		]) {
			const ux = p[0] - a[0],
				uy = p[1] - a[1],
				vx = q[0] - a[0],
				vy = q[1] - a[1];
			const det = ux * vy - uy * vx;
			const u = ((x - a[0]) * vy - (y - a[1]) * vx) / det,
				v = (ux * (y - a[1]) - uy * (x - a[0])) / det;
			if (u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8)
				return a[2] + u * (p[2] - a[2]) + v * (q[2] - a[2]);
		}
	}
	return s.cells.reduce((a, b) =>
		Math.hypot(a.center[0] - x, a.center[1] - y) < Math.hypot(b.center[0] - x, b.center[1] - y)
			? a
			: b
	).center[2];
}
