import { cityPassages, cityRibbonClearance } from './city-passages';
import { courtBench } from './town-grading';
import { surveyedGrid } from './town-grid';
import { area } from '../ansicht/geometrie';
import { required } from '../required';
import { projectTownWalk, surveyTownWalk, courtLanding } from '../walkway-network';
import { walkingHeight, walkingSampler, surfaceHeight } from './network-terrain';
import type { Vec3 } from '../parametrik/types';
import { bankHeight, cellAtPoint, type TerrainCell } from '../terrain-grid';
import type { World } from './world-contract';

function stationPosition(cell: TerrainCell, crossingClearance: number): Vec3 {
	const [x, y] = cell.center;
	const z = Math.max(...cell.corners.map((p) => p[2]));
	const crossing = cell.plan.footbridge || cell.zone === 'water';
	if (cell.landform && !crossing) {
		const ground = cell.bank ? bankHeight(cell, x, y) : surfaceHeight(cell.corners, x, y);
		return [x, y, Math.max(z, ground) + 0.1];
	}
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
	const ground = walkingSampler(world.grid);
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

/** Collects the court mouths and optional house surveys used by routing and projection. */
function corridorInputs(world: World, openingSurvey?: Parameters<typeof cityPassages>[1]) {
	const site = cityCorridorSite(world);
	if (!site) return;
	const relief = surveyedGrid(world.grid);
	const [routes, station, courts, ground, seed] = site;
	const openings = openingSurvey && cityPassages(world, openingSurvey);
	return [
		routes,
		station,
		courts.map((c) => ({ ...c, passages: openings?.get(c.id) })),
		ground,
		seed,
		(x: number, y: number) => walkingHeight(relief, x, y)
	] as const;
}

type OpeningSurvey = Parameters<typeof cityPassages>[1];
function planCorridors(world: World, openingSurvey?: OpeningSurvey) {
	const inputs = corridorInputs(world, openingSurvey);
	if (!inputs) return;
	const water = (x: number, y: number) => {
		const cell = cellAtPoint(world.grid, x, y);
		if (cell?.bank?.water !== undefined && bankHeight(cell, x, y) < cell.bank.water)
			return cell.bank.water;
		return cell?.zone === 'water' ? world.grid.terrain.waterLevel : -Infinity;
	};
	return {
		plan: surveyTownWalk(...inputs, undefined, cityRibbonClearance(world), water),
		ground: inputs[3]
	};
}
const plans = new WeakMap<World, ReturnType<typeof planCorridors>>();
/** Shares the finished alignment between rendering and routing for each immutable world. */
export function cityCorridorPlan(world: World, openingSurvey?: OpeningSurvey) {
	if (openingSurvey) return planCorridors(world, openingSurvey);
	if (!plans.has(world)) plans.set(world, planCorridors(world));
	return plans.get(world);
}
/** Projects the walking graph and court furnishings from the city's finished survey. */
export function cityCorridorPaths(world: World, openingSurvey?: OpeningSurvey) {
	const site = cityCorridorPlan(world, openingSurvey);
	return site ? projectTownWalk(site.plan, site.ground, world.seed) : [];
}
