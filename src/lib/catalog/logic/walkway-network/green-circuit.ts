import type { TerrainGrid, TerrainCell } from '../terrain-grid';
import { required } from '../required';

function crosses(a: TerrainCell, b: TerrainCell, centre: TerrainCell) {
	const [x, y] = centre.center,
		[u, v] = a.center,
		[s, t] = b.center;
	if (v < y === t < y) return false;
	return u + ((s - u) * (y - v)) / (t - v) > x;
}
function crosslessPath(
	start: TerrainCell,
	end: TerrainCell,
	neighbours: Map<TerrainCell, TerrainCell[]>
) {
	const parents = new Map<TerrainCell, TerrainCell>([[start, start]]),
		queue = [start];
	for (const current of queue) {
		if (current === end) {
			const back = [end];
			while (back.at(-1) !== start)
				back.push(required(parents.get(back[back.length - 1]), 'circuit predecessor'));
			return back.map((c) => c.id);
		}
		for (const next of neighbours.get(current) ?? [])
			if (!parents.has(next)) {
				parents.set(next, current);
				queue.push(next);
			}
	}
}
/** Finds a short dry circuit surrounding a fixed green. Cutting the graph along an eastward
 * ray makes a route between opposite banks of the cut wind around the green exactly once. */
export function greenCircuit(
	grid: TerrainGrid,
	centre: TerrainCell,
	blocked: ReadonlySet<string>,
	radius = 60
) {
	const [x, y] = centre.center;
	const district = grid.cells.filter(
		(c) =>
			Math.max(Math.abs(c.center[0] - x), Math.abs(c.center[1] - y)) < radius &&
			!blocked.has(c.id) &&
			c.zone !== 'water'
	);
	const dry = new Set(district);
	const cuts: [TerrainCell, TerrainCell][] = [],
		adjacent = new Map<TerrainCell, TerrainCell[]>();
	for (const cell of district) {
		const around = cell.neighbors
			.flatMap((id) => (id ? (grid.cellsById.get(id) ?? []) : []))
			.filter((c) => dry.has(c));
		const banks = around.filter((c) => crosses(cell, c, centre));
		for (const other of banks) if (cell.index < other.index) cuts.push([cell, other]);
		adjacent.set(
			cell,
			around.filter((c) => !banks.includes(c))
		);
	}
	let shortest: string[] | undefined;
	for (const [a, b] of cuts) {
		const path = crosslessPath(a, b, adjacent);
		if (path && (!shortest || path.length < shortest.length)) shortest = path;
	}
	return shortest;
}

/** Counts dry side-neighbour steps to the green without walking through existing buildings. */
export function greenApproaches(grid: TerrainGrid, ring: string[], blocked: ReadonlySet<string>) {
	const distances = new Map(ring.map((id) => [id, 0])),
		queue = [...ring];
	for (const id of queue) {
		const distance = required(distances.get(id), 'green walk distance') + 1;
		if (distance > 24) continue;
		for (const next of required(grid.cellsById.get(id), 'green path').neighbors) {
			if (
				!next ||
				blocked.has(next) ||
				distances.has(next) ||
				grid.cellsById.get(next)?.zone === 'water'
			)
				continue;
			distances.set(next, distance);
			queue.push(next);
		}
	}
	return distances;
}
