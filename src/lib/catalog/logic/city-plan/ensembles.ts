import { surveyPlaza } from './plaza';
import { area } from '../ansicht/geometrie';
import { townRoutes } from '../walkway-network';
import { required } from '../required';
import { hashUnit } from '../../core/random';
import type { TerrainCell, TerrainGrid } from '../terrain-grid';

type TownEnsemble = {
	openingPlots?: number;
	plaza?: NonNullable<ReturnType<typeof surveyPlaza>>;
	court: string;
	mouth: string;
	lots: string[];
	heights: number[];
};

function envelope(cell: TerrainCell) {
	const xs = cell.corners.map((p) => p[0]),
		ys = cell.corners.map((p) => p[1]);
	return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] as const;
}

function gap(a: ReturnType<typeof envelope>, b: ReturnType<typeof envelope>) {
	return Math.hypot(Math.max(0, a[0] - b[1], b[0] - a[1]), Math.max(0, a[2] - b[3], b[2] - a[3]));
}

function courtGroup(grid: TerrainGrid, court: TerrainCell, free: Set<string>, open: Set<string>) {
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
		if (corners.length !== 2) continue;
		const size = (id: string) =>
			area(required(grid.cellsById.get(id), 'court plot').corners.map(([x, y]) => [x, y]));
		corners.sort((a, b) => size(b) - size(a));
		const anchorArea = size(corners[0]);
		if (wings.some((w) => size(w.id) > anchorArea)) continue;
		const lots = [corners[0], ...wings.map((c) => c.id), corners[1]];
		const extension = wings
			.flatMap((c) => c.neighbors)
			.find(
				(id) =>
					id &&
					free.has(id) &&
					id !== court.id &&
					id !== mouth.id &&
					!lots.includes(id) &&
					size(id) <= anchorArea
			);
		if (!extension) continue;
		const openingPlots = lots.length;
		lots.push(extension);
		const plaza = surveyPlaza(grid, court, mouth, lots, open);
		if (!plaza) continue;
		const low = 2 + Math.floor(hashUnit(grid.terrain.seed, court.id, 'base') * 2);
		const heights = lots.map((_, i) => low + (i === 0 ? 2 : 0));
		return { court: court.id, mouth: plaza.mouth, plaza, lots, heights, openingPlots };
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
	const envelopes = new Map(grid.cells.map((c) => [c.id, envelope(c)]));
	const free = new Set(available.map((c) => c.id));
	const open = new Set(
		grid.cells.filter((c) => c.zone !== 'water' && !reserved.has(c.id)).map((c) => c.id)
	);
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
	const count = 6 + Math.floor(2 * hashUnit(grid.terrain.seed, 'ensemble-count'));
	for (let i = 0; i < count; i++) {
		const district = i % stops.length;
		const found = site(byStop[district]);
		if (!found) {
			if (built.length >= 5) break;
			throw new RangeError('No reachable court in surveyed district');
		}
		const { chosen, route } = found;
		walk = route;
		built.push(chosen);
		groups[district].push(chosen);
		const boxes = [chosen.court, chosen.mouth, ...chosen.lots, ...chosen.plaza.cells].map((id) =>
			required(envelopes.get(id), 'ensemble footprint')
		);
		for (const id of open) {
			const box = required(envelopes.get(id), 'candidate footprint');
			if (boxes.some((b) => gap(box, b) < 12)) {
				free.delete(id);
				open.delete(id);
			}
		}
	}
	return { groups, walk };

	function site(candidates: TerrainCell[]) {
		for (const court of candidates) {
			if (!free.has(court.id)) continue;
			const chosen = courtGroup(grid, court, free, open);
			if (!chosen) continue;
			const route = townRoutes(grid, [...built, chosen], occupied);
			if (route) return { chosen, route };
		}
	}
}
