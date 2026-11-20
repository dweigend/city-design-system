import { cellAtPoint, type TerrainGrid } from '../terrain-grid';
import type { Vec3 } from '../parametrik/types';
import { planBounds, overlaps } from './network-site';
import type { World } from './world-contract';

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

/** Samples the two terrain triangles drawn by the sandbox, split along corners 0–2. */
export function walkingHeight(grid: TerrainGrid, x: number, y: number) {
	const cell = cellAtPoint(grid, x, y);
	if (!cell) return NaN;
	return surfaceHeight(cell.corners, x, y);
}

/** Interpolates a surveyed quad on its rendered diagonal. */
export function surfaceHeight(corners: readonly Vec3[], x: number, y: number) {
	const [a, b, c, d] = corners;
	return (c[0] - a[0]) * (y - a[1]) - (c[1] - a[1]) * (x - a[0]) <= 0
		? triangleHeight(x, y, a, b, c)
		: triangleHeight(x, y, a, c, d);
}

const water = new WeakMap<TerrainGrid, TerrainGrid['cells']>();
/** Surveys water and forest cells whose extents intersect the ensemble's routing window. */
export function blockedOutlines(world: World, window: ReturnType<typeof planBounds>) {
	const wet = water.get(world.grid) ?? world.grid.cells.filter((c) => c.zone === 'water');
	water.set(world.grid, wet);
	const forest = [...world.state.cover].flatMap(([id, cover]) => {
		const cell = world.grid.cellsById.get(id);
		return cover === 'forest' && cell ? [cell] : [];
	});
	return [...wet, ...forest]
		.filter((c) => overlaps(window, planBounds(c.corners)))
		.map((c) => c.corners.map(([x, y]): [number, number] => [x, y]));
}
