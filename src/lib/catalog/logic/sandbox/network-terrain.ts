import { bankHeight, cellAtPoint, type TerrainGrid } from '../terrain-grid';
import { surfaceHeight } from '../quad-grid';
export { surfaceHeight } from '../quad-grid';
import { planBounds, overlaps } from './network-site';
import type { World } from './world-contract';

/** Samples the two terrain triangles drawn by the sandbox, split along corners 0–2. */
export function walkingHeight(grid: TerrainGrid, x: number, y: number) {
	const cell = cellAtPoint(grid, x, y);
	if (!cell) return NaN;
	return cell.bank ? bankHeight(cell, x, y) : surfaceHeight(cell.corners, x, y);
}

/** Samples nearby route stations using the last triangle parcel when the point is strictly inside. */
export function walkingSampler(grid: TerrainGrid) {
	let cell: ReturnType<typeof cellAtPoint>;
	return (x: number, y: number) => {
		const corners = cell?.corners;
		if (
			!corners?.every(([u, v], i) => {
				const next = corners[(i + 1) % 4];
				return (next[0] - u) * (y - v) - (next[1] - v) * (x - u) > 1e-9;
			})
		)
			cell = cellAtPoint(grid, x, y);
		if (!cell) return NaN;
		return cell.bank ? bankHeight(cell, x, y) : surfaceHeight(cell.corners, x, y);
	};
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
