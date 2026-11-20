import { required } from '../required';
import type { TerrainGrid } from '../terrain-grid';

type Gate = {
	court: string;
	mouth: string;
	plaza?: { cells: readonly string[] };
	lots: readonly string[];
};

function connection(
	grid: TerrainGrid,
	start: string,
	blocked: Set<string>,
	joins: (id: string) => boolean
) {
	const parent = new Map<string, string>([[start, start]]),
		queue = [start];
	for (const id of queue) {
		const cell = required(grid.cellsById.get(id), 'surveyed site');
		for (const next of cell.neighbors) {
			if (!next || parent.has(next) || grid.cellsById.get(next)?.zone === 'water') continue;
			if (joins(next)) return trace(next, id, start, parent);
			if (blocked.has(next)) continue;
			parent.set(next, id);
			queue.push(next);
		}
	}
}

function trace(next: string, id: string, start: string, parent: Map<string, string>) {
	const path = [next, id];
	while (path[path.length - 1] !== start)
		path.push(required(parent.get(path[path.length - 1]), 'walk predecessor'));
	return path.reverse();
}

function traceLoop(grid: TerrainGrid, marks: string[], blocked: Set<string>) {
	const loop = [marks[0]];
	for (const next of [...marks.slice(1), marks[0]]) {
		const last = loop[loop.length - 1];
		const path = connection(
			grid,
			last,
			new Set([...blocked, ...loop, ...marks]),
			(id) => id === next
		);
		if (!path || path.length > 16) return;
		loop.push(...path.slice(1));
	}
	return loop;
}
function greenLoop(
	grid: TerrainGrid,
	gates: readonly Gate[],
	blocked: Set<string>,
	border: readonly string[]
) {
	const mouths = new Set(gates.map((g) => g.mouth));
	const dry = (id: string) =>
		(mouths.has(id) || !blocked.has(id)) && grid.cellsById.get(id)?.zone !== 'water';
	const clear = border.filter(dry);
	if (clear.length < 4) return;
	const corners = [0, 1, 2, 3].map((i) => clear[Math.floor((clear.length * i) / 4)]);
	const loop =
		traceLoop(grid, clear, blocked) ??
		traceLoop(grid, corners, blocked) ??
		traceLoop(grid, corners.reverse(), blocked);
	return loop;
}
function ringPaths(
	grid: TerrainGrid,
	gates: readonly Gate[],
	blocked: Set<string>,
	border: readonly string[]
) {
	const loop = greenLoop(grid, gates, blocked, border);
	if (!loop) return;
	const ring = loop.slice(0, -1);
	const available = new Set(ring);
	for (const id of ring) blocked.add(id);
	const paths = [loop];
	for (const gate of gates) {
		const path = available.has(gate.mouth)
			? [gate.mouth]
			: connection(grid, gate.mouth, blocked, (id) => available.has(id));
		if (!path) return;
		paths.push([gate.court, ...path]);
		for (const id of path) {
			blocked.add(id);
			available.add(id);
		}
		available.delete(path[path.length - 1]);
	}
	return paths;
}
/** Routes dry side-neighbour paths between the three-sided courts. Ends stay in
 * their court and internal stations admit three arms. An isolated site returns undefined. */
export function townRoutes(
	grid: TerrainGrid,
	gates: readonly Gate[],
	occupied: ReadonlySet<string>,
	border?: readonly string[]
) {
	if (!gates.length && !border) return [];
	const blocked = new Set([
		...occupied,
		...gates.flatMap((g) => [...g.lots, ...(g.plaza?.cells ?? []), g.court, g.mouth])
	]);
	if (border) return ringPaths(grid, gates, blocked, border);
	const first = gates[0],
		start = required(grid.cellsById.get(first.mouth), 'court mouth');
	if (
		gates.length === 1 &&
		!connection(grid, start.id, blocked, (id) => {
			const c = required(grid.cellsById.get(id), 'open ground');
			return (
				!blocked.has(id) &&
				Math.hypot(c.center[0] - start.center[0], c.center[1] - start.center[1]) >= 40
			);
		})
	)
		return;
	const paths = [[first.court, first.mouth]];
	const available = new Map<string, number>([[first.mouth, 2]]);
	for (const gate of gates.slice(1)) {
		const path = connection(grid, gate.mouth, blocked, (id) => (available.get(id) ?? 0) > 0);
		if (!path) return;
		paths.push([gate.court, ...path]);
		for (const id of path) {
			blocked.add(id);
			available.set(id, (available.get(id) ?? 2) - 1);
		}
	}
	return paths;
}
