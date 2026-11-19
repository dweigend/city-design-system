import { faceSeam } from '../district-frame';
import type { TerrainGrid } from '../terrain-grid';
type Side = { cellId: string; side: number };
type Seam = { id: string; vertices: [string, string]; sides: Side[]; groundStep: number | null };
const cache = new WeakMap<TerrainGrid, ReturnType<typeof index>>();

function index(grid: TerrainGrid) {
	const seams = new Map<string, Seam>();
	for (const cell of grid.cells)
		for (const [side, n] of cell.neighbors.entries()) {
			const { id, vertices } = faceSeam(cell, side);
			if (seams.has(id)) continue;
			const other = n ? grid.cellsById.get(n) : undefined;
			const sides = [{ cellId: cell.id, side }];
			if (other) sides.push({ cellId: other.id, side: other.neighbors.indexOf(cell.id) });
			seams.set(id, {
				id,
				vertices,
				sides,
				groundStep: other ? Math.abs(cell.center[2] - other.center[2]) : null
			});
		}
	return seams;
}
/** Indexes opposite centre samples and both side addresses once per immutable terrain revision. */
export function seamIncidence(grid: TerrainGrid): ReadonlyMap<string, Seam> {
	const saved = cache.get(grid);
	if (saved) return saved;
	const result = index(grid);
	cache.set(grid, result);
	return result;
}
