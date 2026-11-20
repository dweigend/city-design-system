import { townRoutes } from '../walkway-network';
import { required } from '../required';
import { hashUnit } from '../../core/random';
import type { TerrainCell, TerrainGrid } from '../terrain-grid';

type TownEnsemble = { court: string; mouth: string; lots: string[]; heights: number[] };

function envelope(cell: TerrainCell) {
	const xs = cell.corners.map((p) => p[0]),
		ys = cell.corners.map((p) => p[1]);
	return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] as const;
}

function gap(a: ReturnType<typeof envelope>, b: ReturnType<typeof envelope>) {
	return Math.hypot(Math.max(0, a[0] - b[1], b[0] - a[1]), Math.max(0, a[2] - b[3], b[2] - a[3]));
}

function courtGroup(grid: TerrainGrid, court: TerrainCell, free: Set<string>) {
	const sides = court.neighbors.map((id) => id && grid.cellsById.get(id));
	for (let i = 0; i < 4; i++) {
		const mouth = sides[i];
		if (!mouth || !free.has(mouth.id)) continue;
		const wings = sides.filter((c): c is TerrainCell => !!c && c !== mouth && free.has(c.id));
		if (wings.length !== 3) continue;
		const corners = wings.flatMap((c, j) =>
			wings
				.slice(j + 1)
				.flatMap((other) =>
					c.neighbors.filter(
						(id): id is string =>
							!!id && id !== court.id && free.has(id) && other.neighbors.includes(id)
					)
				)
		);
		if (!corners.length) continue;
		const lots = [...new Set([...wings.map((c) => c.id), ...corners])];
		const low = 2 + Math.floor(hashUnit(grid.terrain.seed, court.id, 'base') * 2);
		const heights = lots.map(
			(id, j) => low + (j === 0 ? 3 : Math.floor(hashUnit(grid.terrain.seed, id, 'step') * 2))
		);
		return { court: court.id, mouth: mouth.id, lots, heights };
	}
}

/** Reserves three-sided courts nearest each station in turn. Distances between
 * conservative parcel envelopes include the entire twelve-metre building setback. */
export function planEnsembles(
	grid: TerrainGrid,
	stops: TerrainCell[],
	land: TerrainCell[],
	reserved: Set<string>,
	occupied: Set<string>
) {
	const available = land.filter((c) => !reserved.has(c.id));
	const envelopes = new Map(available.map((c) => [c.id, envelope(c)]));
	const free = new Set(envelopes.keys());
	const byStop = stops.map((stop) =>
		[...available].sort((a, b) => {
			const distance = (c: TerrainCell) =>
				Math.hypot(c.center[0] - stop.center[0], c.center[1] - stop.center[1]);
			return distance(a) - distance(b) || a.index - b.index;
		})
	);
	const groups = stops.map((): TownEnsemble[] => []);
	let walk: string[][] = [];
	const built: TownEnsemble[] = [];
	const count = 5 + Math.floor(4 * hashUnit(grid.terrain.seed, 'ensemble-count'));
	for (let i = 0; i < count; i++) {
		const district = i % stops.length;
		const { chosen, route } = site(byStop[district]);
		walk = route;
		built.push(chosen);
		groups[district].push(chosen);
		const boxes = [chosen.court, chosen.mouth, ...chosen.lots].map((id) =>
			required(envelopes.get(id), 'ensemble footprint')
		);
		for (const id of free) {
			const box = required(envelopes.get(id), 'candidate footprint');
			if (boxes.some((b) => gap(box, b) < 12)) free.delete(id);
		}
	}
	return { groups, walk };

	function site(candidates: TerrainCell[]) {
		for (const court of candidates) {
			if (!free.has(court.id)) continue;
			const chosen = courtGroup(grid, court, free);
			if (!chosen) continue;
			const route = townRoutes(grid, [...built, chosen], occupied);
			if (route) return { chosen, route };
		}
		throw new RangeError('No reachable court in surveyed district');
	}
}
