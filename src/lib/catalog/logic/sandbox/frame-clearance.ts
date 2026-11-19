import { faceSeam } from '../district-frame';
import type { TerrainCell, TerrainGrid } from '../terrain-grid';

/** Groups connected square cells; measures their external perimeter and its framed portion once. */
export function squareShares(grid: TerrainGrid, main: ReadonlySet<string>) {
	const shares = new Map<string, number>(),
		visited = new Set<string>();
	for (const cell of grid.cells) if (cell.plan.square && !visited.has(cell.id)) visitSquare(cell);
	function visitSquare(cell: TerrainCell) {
		const queue = [cell],
			boundary: string[] = [];
		visited.add(cell.id);
		let total = 0,
			framed = 0;
		for (let i = 0; i < queue.length; i++) {
			const c = queue[i];
			c.neighbors.forEach((id, side) => {
				const n = id && grid.cellsById.get(id);
				if (n && n.plan.square) {
					if (!visited.has(n.id)) {
						visited.add(n.id);
						queue.push(n);
					}
					return;
				}
				const j = (side + 1) % 4,
					a = c.corners[side],
					b = c.corners[j];
				const key = faceSeam(c, side).id;
				const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
				total += length;
				if (main.has(key)) framed += length;
				boundary.push(key);
			});
		}
		if (total) for (const key of boundary) shares.set(key, framed / total);
	}
	return shares;
}
