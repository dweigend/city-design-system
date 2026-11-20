import { courtBench } from './town-grading';
import { surveyedGrid } from './town-grid';
import { area } from '../ansicht/geometrie';
import { required } from '../required';
import { townDeck, courtLanding } from '../walkway-network';
import { walkingHeight } from './network-terrain';
import type { World } from './world-contract';

/** Projects the public court walks and green circuits shared by the game and bible. */
export function cityCorridorPaths(world: World) {
	const city = world.state.city;
	if (!city?.walk) return [];
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
	return townDeck(
		city.walk,
		(id) => {
			const c = cell(id);
			const [x, y] = c.center;
			const z = Math.max(...c.corners.map((p) => p[2]));
			const crossing = c.plan.footbridge || c.zone === 'water';
			const level = crossing
				? Math.max(c.pad, z + world.grid.profile.footbridgeClearance)
				: Math.ceil(2 * (z - 0.08)) / 2 + 0.4;
			return [x, y, level];
		},
		courts,
		ground,
		world.seed,
		(x, y) => walkingHeight(surveyedGrid(world.grid), x, y)
	);
}
