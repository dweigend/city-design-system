import { courtBench } from './town-grading';
import { surveyedGrid } from './town-grid';
import { area } from '../ansicht/geometrie';
import { required } from '../required';
import { townDeck, courtLanding } from '../walkway-network';
import { walkingHeight } from './network-terrain';
import type { Vec3 } from '../parametrik/types';
import { bankHeight, type TerrainCell } from '../terrain-grid';
import type { World } from './world-contract';

function stationPosition(cell: TerrainCell, crossingClearance: number): Vec3 {
	const [x, y] = cell.center;
	const z = Math.max(...cell.corners.map((p) => p[2]));
	const crossing = cell.plan.footbridge || cell.zone === 'water';
	const level = crossing
		? Math.max(cell.pad, z + crossingClearance)
		: Math.ceil(2 * (z - 0.08)) / 2 + 0.4;
	return [x, y, Math.max(level, bankHeight(cell, x, y) + 0.1)];
}

/** Returns routes, surveyed station positions (x, y, walking elevation in metres), court sites,
 * the finished ground sampler and seed. Court site positions carry their finished floor elevation. */
export function cityCorridorSite(world: World) {
	const city = world.state.city;
	if (!city?.walk) return;
	const cell = (id: string) => required(world.grid.cellsById.get(id), 'surveyed site');
	const ground = (x: number, y: number) => walkingHeight(world.grid, x, y);
	const courts = city.centres.flatMap((c) =>
		(c.ensembles ?? []).map((group) => {
			const inset = courtLanding(cell(group.court), courtBench(surveyedGrid(world.grid), group));
			const plan = group.plaza;
			if (!plan) return inset;
			const polygon = plan.polygon;
			const x = (polygon[0][0] + polygon[2][0]) / 2,
				y = (polygon[0][1] + polygon[2][1]) / 2;
			const z = inset.position[2];
			return {
				...inset,
				polygon,
				area: area(polygon),
				position: [x, y, z] as [number, number, number],
				aprons: plan.apron.length ? [inset.polygon, plan.apron] : []
			};
		})
	);
	const stations = new Map(
		[...new Set(city.walk.flat())].map(
			(id) => [id, stationPosition(cell(id), world.grid.profile.footbridgeClearance)] as const
		)
	);
	const station = (id: string) => required(stations.get(id), 'surveyed walk station');
	return [city.walk, station, courts, ground, world.seed] as const;
}

/** Projects public courts and walks from the same station survey as the centreline planner. */
export function cityCorridorPaths(world: World) {
	const site = cityCorridorSite(world);
	if (!site) return [];
	const relief = surveyedGrid(world.grid);
	return townDeck(...site, (x, y) => walkingHeight(relief, x, y));
}
