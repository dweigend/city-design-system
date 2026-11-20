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
	starts: readonly string[],
	blocked: Set<string>,
	joins: (id: string) => boolean
) {
	const parent = new Map(starts.map((id) => [id, id])),
		queue = [...starts];
	for (const id of queue) {
		const cell = required(grid.cellsById.get(id), 'surveyed site');
		for (const next of cell.neighbors) {
			if (!next || parent.has(next) || grid.cellsById.get(next)?.zone === 'water') continue;
			if (joins(next)) return trace(next, id, parent);
			if (blocked.has(next)) continue;
			parent.set(next, id);
			queue.push(next);
		}
	}
}

function trace(next: string, id: string, parent: Map<string, string>) {
	const path = [next, id];
	while (parent.get(id) !== id) {
		id = required(parent.get(id), 'walk predecessor');
		path.push(id);
	}
	return path.reverse();
}

function traceLoop(grid: TerrainGrid, marks: string[], blocked: Set<string>) {
	const loop = [marks[0]];
	for (const next of [...marks.slice(1), marks[0]]) {
		const last = loop[loop.length - 1];
		const path = connection(
			grid,
			[last],
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
			: connection(grid, [gate.mouth], blocked, (id) => available.has(id));
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
		!connection(grid, [start.id], blocked, (id) => {
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
		const path = connection(grid, [gate.mouth], blocked, (id) => (available.get(id) ?? 0) > 0);
		if (!path) return;
		paths.push([gate.court, ...path]);
		for (const id of path) {
			blocked.add(id);
			available.set(id, (available.get(id) ?? 2) - 1);
		}
	}
	return paths;
}

/** Joins each reachable centre to the nearest free arm of the growing public walk.
 * Side-neighbour breadth-first search measures distance in surveyed cells. */
export function linkCentres(grid: TerrainGrid, networks: string[][][], occupied: Set<string>) {
	const degree = new Map<string, number>();
	const register = (paths: string[][]) => {
		for (const path of paths)
			for (let i = 1; i < path.length; i++)
				for (const id of [path[i - 1], path[i]]) degree.set(id, (degree.get(id) ?? 0) + 1);
	};
	register(networks.flat());
	const arms = (cells: Iterable<string>) =>
		[...cells].filter((id) => !occupied.has(id) && (degree.get(id) ?? 0) < 3);
	const pending = new Map(networks.map((paths, i) => [i, new Set(paths.flat())]));
	const first = networks.findIndex((paths) => paths.length > 0);
	const connected = new Set(pending.get(first));
	pending.delete(first);
	const links: string[][] = [];
	while (pending.size) {
		const targets = new Map(
			[...pending].flatMap(([i, ids]) => arms(ids).map((id) => [id, i] as const))
		);
		const path = connection(grid, arms(connected), new Set([...occupied, ...degree.keys()]), (id) =>
			targets.has(id)
		);
		if (!path) break;
		const index = required(targets.get(path[path.length - 1]), 'destination centre');
		for (const id of required(pending.get(index), 'centre walk')) connected.add(id);
		for (const id of path) connected.add(id);
		register([path]);
		links.push(path);
		pending.delete(index);
	}
	return { links, isolated: [...pending.keys()] };
}
