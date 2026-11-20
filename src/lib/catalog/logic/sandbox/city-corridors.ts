import { area } from '../ansicht/geometrie';
import { required } from '../required';
import { townDeck, courtLanding } from '../walkway-network';
import { walkingHeight } from './network-terrain';
import type { World } from './world-contract';

/** Projects the public court-to-court tree shared by the game and bible. */
export function cityCorridorPaths(world: World) {
	const city = world.state.city;
	if (!city?.walk) return [];
	const cell = (id: string) => required(world.grid.cellsById.get(id), 'surveyed site');
	const ground = (x: number, y: number) => walkingHeight(world.grid, x, y);
	const courts = city.centres.flatMap((c) =>
		c.ensembles.map((group) => {
			const inset = courtLanding(cell(group.court));
			const plan = group.plaza;
			if (!plan) return inset;
			const polygon = plan.polygon;
			const x = (polygon[0][0] + polygon[2][0]) / 2,
				y = (polygon[0][1] + polygon[2][1]) / 2;
			const z = Math.max(inset.position[2], ...polygon.map(([u, v]) => ground(u, v) + 0.6));
			return {
				...inset,
				polygon,
				area: area(polygon),
				position: [x, y, z] as [number, number, number],
				aprons: [inset.polygon, plan.apron]
			};
		})
	);
	return townDeck(city.walk, (id) => cell(id).center, courts, ground, world.seed);
}
