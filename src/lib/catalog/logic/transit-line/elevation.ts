import { cellAtPoint, type TerrainGrid } from '../terrain-grid';
import type { Vec3 } from '../parametrik/types';
import { chainage, segment } from './alignment';

// Use a fan of four triangles so all five measured cell heights are honored.
export function groundAt(grid: TerrainGrid, x: number, y: number) {
	const cell = cellAtPoint(grid, x, y);
	if (!cell) {
		// A chord can cross the concave map boundary. Extend its nearest cell's datum.
		let distance = Infinity,
			height = 0;
		for (const { center } of grid.cells) {
			const d = Math.hypot(x - center[0], y - center[1]);
			if (d < distance) {
				distance = d;
				height = center[2];
			}
		}
		return height;
	}
	const [cx, cy, cz] = cell.center;
	for (const [i, a] of cell.corners.entries()) {
		const b = cell.corners[(i + 1) % 4],
			ax = a[0] - cx,
			ay = a[1] - cy,
			bx = b[0] - cx,
			by = b[1] - cy;
		const det = ax * by - ay * bx,
			u = ((x - cx) * by - (y - cy) * bx) / det,
			v = (ax * (y - cy) - ay * (x - cx)) / det;
		if (u >= -1e-10 && v >= -1e-10) return cz + u * (a[2] - cz) + v * (b[2] - cz);
	}
	return cz;
}
export function elevate(grid: TerrainGrid, plan: Vec3[], grade: number, clearance: number) {
	const s = chainage(plan),
		floor = plan.map(([x, y]) => groundAt(grid, x, y) + clearance);
	const h = [...floor];
	for (let i = 1; i < h.length; i++) h[i] = Math.max(h[i], h[i - 1] - grade * (s[i] - s[i - 1]));
	for (let i = h.length - 2; i >= 0; i--)
		h[i] = Math.max(h[i], h[i + 1] - grade * (s[i + 1] - s[i]));
	// Averaging translations of a grade-limited profile preserves its slope bound.
	const height = (at: number) => {
		const d = Math.min(Math.max(0, at), s[s.length - 1]),
			i = segment(s, d);
		return h[i] + ((h[i + 1] - h[i]) * (d - s[i])) / (s[i + 1] - s[i]);
	};
	const offsets = [-6, -4, -2, 0, 2, 4, 6];
	const smooth = s.map((d) => offsets.reduce((sum, o) => sum + height(d + o), 0) / offsets.length);
	const lift = floor.reduce((max, z, i) => Math.max(max, z - smooth[i]), 0);
	return plan.map(([x, y], i): Vec3 => [x, y, smooth[i] + lift]);
}
