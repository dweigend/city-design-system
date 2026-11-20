import { intersect, shoelaceArea } from '../parametrik/raster/geometry';
import type { CityPlan } from '../city-plan';
import type { Vec3 } from '../parametrik/types';
import type { TerrainCell, TerrainGrid } from '../terrain-grid';
import { required } from '../required';
import { surfaceHeight } from './network-terrain';

type Corners = TerrainCell['corners'];
type Court = CityPlan['centres'][number]['ensembles'][number];
type Point = [number, number];

function mapCorners([a, b, c, d]: Corners, project: (p: Vec3) => Vec3): Corners {
	return [project(a), project(b), project(c), project(d)];
}

/** Sets the earth bench under the paving from the raw survey, in half-metre courses. */
export function courtBench(grid: TerrainGrid, court: Court) {
	const ids = court.plaza?.cells.length ? court.plaza.cells : [court.court];
	const levels = ids.map((id) => required(grid.cellsById.get(id), 'court ground').center[2]);
	return Math.round((2 * levels.reduce((sum, z) => sum + z, 0)) / levels.length) / 2;
}

function benchCells(grid: TerrainGrid, court: Court) {
	const cell = (id: string) => required(grid.cellsById.get(id), 'court parcel');
	const plan = court.plaza;
	if (!plan?.cells.length) return [cell(court.court)];
	const floors = [plan.polygon, plan.apron].filter((p) => p.length > 2);
	const cells = plan.cells.map(cell).filter((c) => {
		const poly = c.corners.map(([x, y]): Point => [x, y]);
		return floors.some((f) => Math.abs(shoelaceArea(intersect(poly, f))) > 1e-8);
	});
	if (plan.apron.length) cells.push(cell(court.court));
	return cells;
}

function gradeCell(c: TerrainCell, vertex: (p: Vec3) => Vec3, house: boolean): TerrainCell {
	const corners = mapCorners(c.corners, vertex);
	const survey = ([x, y]: Vec3): Vec3 => [x, y, surfaceHeight(corners, x, y)];
	const lotCorners = c.lotCorners && mapCorners(c.lotCorners, survey);
	const pad =
		house && !c.raised ? Math.min(c.pad, ...(lotCorners ?? corners).map((p) => p[2])) : c.pad;
	return { ...c, corners, center: survey(c.center), lotCorners, pad };
}

function bermHouse(levels: Map<Vec3, number>, cell: TerrainCell) {
	if (cell.raised || !cell.buildable) return;
	for (const p of cell.corners) levels.set(p, Math.max(levels.get(p) ?? -Infinity, cell.pad));
}

function benchCourt(levels: Map<Vec3, number>, grid: TerrainGrid, court: Court) {
	const bench = courtBench(grid, court);
	for (const cell of benchCells(grid, court)) {
		if (cell.zone === 'water') continue;
		for (const p of cell.corners) levels.set(p, Math.max(bench, Math.min(bench + 0.55, p[2])));
	}
}

/** Fits the shared contour lattice to dry house seats and the actual paved footprint of each court. */
export function gradeTown(grid: TerrainGrid, city: CityPlan) {
	const levels = new Map<Vec3, number>();
	const courts = city.centres.flatMap((centre) => centre.ensembles ?? []);
	const plots = new Set(courts.flatMap((court) => court.lots));
	for (const id of plots) bermHouse(levels, required(grid.cellsById.get(id), 'house parcel'));
	for (const court of courts) benchCourt(levels, grid, court);
	const points = new Map(
		[...levels]
			.filter(([p, z]) => p[2] >= grid.terrain.waterLevel && p[2] !== z)
			.map(([p, z]) => [p, [p[0], p[1], z] as Vec3])
	);
	const vertex = (p: Vec3) => points.get(p) ?? p;
	const cell = (c: TerrainCell) =>
		c.corners.some((p) => points.has(p)) ? gradeCell(c, vertex, plots.has(c.id)) : c;
	return { vertex, cell };
}
