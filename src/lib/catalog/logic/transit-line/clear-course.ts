import { required } from '../required';
import { cellId, cellsBetween, type TerrainGrid, type TerrainCell } from '../terrain-grid';

type Box = readonly [number, number, number, number];
type Point = readonly number[];
function bounds(points: readonly Point[], margin: number): Box {
	const xs = points.map((p) => p[0]),
		ys = points.map((p) => p[1]);
	return [
		Math.min(...xs) - margin,
		Math.max(...xs) + margin,
		Math.min(...ys) - margin,
		Math.max(...ys) + margin
	];
}
function intersects(a: Point, b: Point, box: Box) {
	let entry = 0,
		exit = 1;
	for (const i of [0, 1]) {
		const d = b[i] - a[i],
			low = box[2 * i],
			high = box[2 * i + 1];
		if (Math.abs(d) < 1e-9) {
			if (a[i] < low || a[i] > high) return false;
		} else {
			const t = (low - a[i]) / d,
				u = (high - a[i]) / d;
			entry = Math.max(entry, Math.min(t, u));
			exit = Math.min(exit, Math.max(t, u));
		}
	}
	return entry <= exit;
}

/** Retains the longest straight, routable part of a surveyed corridor. The full
 * track and stations stop outside stock footprints and the public deck reserve. */
export function clearCourse(
	grid: TerrainGrid,
	link: readonly [string, string],
	occupied: readonly string[],
	paths: readonly string[][]
) {
	const center = (id: string) => required(grid.cellsById.get(id), 'surveyed site').center;
	const boxes = occupied.map((id) =>
		bounds(required(grid.cellsById.get(id), 'surveyed site').corners, 5)
	);
	for (const path of paths)
		for (let i = 1; i < path.length; i++)
			boxes.push(bounds([center(path[i - 1]), center(path[i])], 12));
	const stops = link.map((id) => required(grid.cellsById.get(id), 'station'));
	for (const offset of [0, 3, -3, 6, -6, 9, -9]) {
		const [a, b] = stops.map((c) => cellId(c.column, c.row + offset));
		const pair = clearSpan(cellsBetween(grid, a, b), boxes);
		if (pair) return pair;
	}
}

function clearSpan(cells: TerrainCell[], boxes: Box[]) {
	let best = 24,
		pair: [string, string] | undefined;
	for (const [i, a] of cells.entries())
		for (const b of cells.slice(i + 1)) {
			const length = Math.hypot(a.center[0] - b.center[0], a.center[1] - b.center[1]);
			if (length < best || boxes.some((box) => intersects(a.center, b.center, box))) continue;
			pair = [a.id, b.id];
			best = length;
		}
	return pair;
}
