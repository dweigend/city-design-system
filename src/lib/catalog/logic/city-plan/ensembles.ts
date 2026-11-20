import { hashUnit } from '../../core/random';
import { surveyPlaza } from './plaza';
import { greenAt, greenParcels } from './green';
import { aroundGreen, clusterSite, clusterSetback, parcelBox } from './cluster';
import { courtGroup } from './court-group';
import { greenCircuit, greenApproaches, townRoutes } from '../walkway-network';
import type { TerrainCell, TerrainGrid } from '../terrain-grid';

type TownEnsemble = {
	openingPlots?: number;
	plaza?: NonNullable<ReturnType<typeof surveyPlaza>>;
	court: string;
	mouth: string;
	lots: string[];
	heights: number[];
};

/** Reserves dry court ensembles around each existing centre, together with their green and its access. */
export function planEnsembles(
	grid: TerrainGrid,
	stops: TerrainCell[],
	land: TerrainCell[],
	reserved: Set<string>,
	occupied: Set<string>
) {
	const available = land.filter((c) => !reserved.has(c.id));
	const envelopes = new Map(grid.cells.map((c) => [c.id, parcelBox(c)]));
	const free = new Set(available.map((c) => c.id));
	const open = new Set(
		grid.cells.filter((c) => c.zone !== 'water' && !reserved.has(c.id)).map((c) => c.id)
	);
	const greens = stops.map((stop) => greenAt(grid, stop));
	const gates = new Set(open);
	const forbidden = new Set(greens.flatMap((g) => g.cells));
	for (const id of forbidden) {
		if (!greens.some((g) => g.ring.includes(id))) gates.delete(id);
		open.delete(id);
		free.delete(id);
	}
	const groups: TownEnsemble[][] = [],
		walk: string[][] = [];
	const planting: string[][] = [];
	for (const [index, stop] of stops.entries()) {
		const green = greens[index],
			[x, y] = stop.center;
		const inner = green.cells.filter((id) => !green.ring.includes(id));
		const obstacles = new Set([...occupied, ...inner, ...walk.flat()]);
		const ring =
			greenCircuit(grid, stop, obstacles) ?? greenCircuit(grid, stop, obstacles, 90) ?? green.ring;
		for (const id of ring) {
			free.delete(id);
			open.delete(id);
		}
		const nearby = grid.cells.filter(
			(c) => Math.abs(c.center[0] - x) < 62 && Math.abs(c.center[1] - y) < 62 && open.has(c.id)
		);
		const survey = { grid, free, open, gates };
		const reach = greenApproaches(grid, ring, obstacles);
		const sites = (compact: boolean) =>
			nearby
				.flatMap((c) => [...courtGroup(survey, c, compact)])
				.map((g) => clusterSite(g, stop, grid, envelopes, reach))
				.filter((s) => s !== undefined);
		const target = 3 + Math.floor(hashUnit(grid.terrain.seed, stop.id, 'cluster-size') * 2);
		const chosen = aroundGreen([...sites(false), ...sites(true)], target);
		const route = () =>
			townRoutes(grid, chosen, obstacles, ring) ?? townRoutes(grid, chosen, obstacles);
		let routes = route();
		while (!routes && chosen.length) {
			chosen.pop();
			routes = route();
		}
		routes ??= [];
		walk.push(...routes);
		groups.push(chosen);
		const footprints = chosen.flatMap((g) => [...g.lots, ...g.plaza.cells, g.mouth, g.court]);
		const blocked = new Set([
			...occupied,
			...footprints,
			...walk.flat().filter((id) => !green.cells.includes(id))
		]);
		green.ring = routes.find((path) => path[0] === path[path.length - 1]) ?? [];
		planting.push(
			greenParcels(
				grid,
				stop,
				chosen.map((g) => g.court),
				green.cells,
				blocked
			)
		);
		for (const id of [...footprints, ...clusterSetback(chosen, envelopes)]) {
			gates.delete(id);
			free.delete(id);
			open.delete(id);
		}
	}
	return { groups, walk, greens, planting };
}
