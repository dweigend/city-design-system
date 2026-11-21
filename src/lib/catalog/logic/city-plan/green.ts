import { cellAtPoint, cellId, type TerrainCell, type TerrainGrid } from '../terrain-grid';
import { required } from '../required';

type Point = [number, number];
/** Surveys the fixed twenty-metre green at a plan centre and its outside walk. */
export function greenAt(grid: TerrainGrid, stop: TerrainCell, margin = 0) {
	const [x, y] = stop.center;
	const polygon: Point[] = [
		[-10, -10],
		[10, -10],
		[10, 10],
		[-10, 10]
	].map(([a, b]) => [x + a, y + b]);
	const corners = polygon.map((p) => cellAtPoint(grid, ...p) ?? stop);
	const xs = corners.map((c) => c.column),
		ys = corners.map((c) => c.row);
	const l = Math.max(0, Math.min(...xs) - margin),
		r = Math.min(grid.columns - 1, Math.max(...xs) + margin);
	const b = Math.max(0, Math.min(...ys) - margin),
		t = Math.min(grid.rows - 1, Math.max(...ys) + margin);
	const ring: string[] = [],
		cells: string[] = [];
	for (let i = l; i < r; i++) ring.push(cellId(i, b));
	for (let j = b; j < t; j++) ring.push(cellId(r, j));
	for (let i = r; i > l; i--) ring.push(cellId(i, t));
	for (let j = t; j > b; j--) ring.push(cellId(l, j));
	for (let j = b + 1; j < t; j++) for (let i = l + 1; i < r; i++) cells.push(cellId(i, j));
	return { polygon, ring, cells: [...cells, ...ring] };
}

/** Supplement the central lawn with planted parcels in the gaps towards each court. */
export function greenParcels(
	grid: TerrainGrid,
	stop: TerrainCell,
	courts: string[],
	cells: string[],
	blocked: Set<string>
) {
	const centres = courts.map((id) => required(grid.cellsById.get(id), 'green neighbour').center);
	const [x, y] = stop.center;
	const midpoints = centres.flatMap(([u, v], i) => [
		[(x + u) / 2, (y + v) / 2],
		...centres.slice(i + 1).map((q) => [(u + q[0]) / 2, (v + q[1]) / 2])
	]);
	const plantingRadius = 10;
	const xs = midpoints.map(([x]) => x),
		ys = midpoints.map(([, y]) => y);
	const left = Math.min(...xs) - plantingRadius,
		right = Math.max(...xs) + plantingRadius;
	const bottom = Math.min(...ys) - plantingRadius,
		top = Math.max(...ys) + plantingRadius;
	const nearby = grid.cells.filter(
		({ center: [x, y] }) =>
			x >= left &&
			x <= right &&
			y >= bottom &&
			y <= top &&
			midpoints.some(([a, b]) => Math.hypot(x - a, y - b) < plantingRadius)
	);
	const ids = new Set([...cells, ...nearby.map((c) => c.id)]);
	return [...ids].filter((id) => !blocked.has(id) && grid.cellsById.get(id)?.plantable);
}
