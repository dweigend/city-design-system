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
		c.ensembles.map((group) => courtLanding(cell(group.court)))
	);
	return townDeck(city.walk, (id) => cell(id).center, courts, ground, world.seed);
}
