import { quadGrid, type QuadGrid, type QuadCell } from '../quad-grid';
import type { TerrainGrid } from '../terrain-grid';

const carriers = new WeakMap<TerrainGrid, QuadGrid>();

/** Building footprints exclude the public passage. Only uninterrupted sides can join a mass. */
export function buildingPlots(grid: TerrainGrid) {
	const cached = carriers.get(grid);
	if (cached) return cached;
	const cells = grid.cells.map((cell): QuadCell => {
		const joinedSide = (side: number) => {
			const id = cell.neighbors[side];
			const next = id && grid.cellsById.get(id);
			if (!next) return null;
			if (!cell.lotCorners && !next.lotCorners) return id;
			const other = next.neighbors.indexOf(cell.id);
			const a = cell.lotCorners ?? cell.corners,
				b = next.lotCorners ?? next.corners;
			return a[side] === b[(other + 1) % 4] && a[(side + 1) % 4] === b[other] ? id : null;
		};
		const neighbors = [joinedSide(0), joinedSide(1), joinedSide(2), joinedSide(3)] as const;
		if (!cell.lotCorners && neighbors.every((id, i) => id === cell.neighbors[i])) return cell;
		if (!cell.lotCorners) return { ...cell, neighbors };
		const corners = cell.lotCorners;
		const mean = (i: number) => corners.reduce((s, p) => s + p[i], 0) / 4;
		const vertex = (i: number) =>
			corners[i] === cell.corners[i] ? cell.vertexIds[i] : cell.id + ':front:' + i;
		return {
			...cell,
			corners,
			vertexIds: [vertex(0), vertex(1), vertex(2), vertex(3)],
			center: [mean(0), mean(1), mean(2)],
			neighbors
		};
	});
	const carrier = quadGrid(cells);
	carriers.set(grid, carrier);
	return carrier;
}
