import { planCity } from '../city-plan';
import { planTownForms } from '../town-forms';
import { applyEdit, type World } from './world';
import { growCity } from './city-growth';

/** Establishes city districts around the editable opening's surveyed rail terminals. */
export function openCity(world: World, protectedIds: readonly string[] = []): World {
	const { grid, state } = world;
	const occupied = new Set([...state.stacks.keys(), ...state.cover.keys(), ...protectedIds]);
	const town = planTownForms(grid, world.seed, occupied);
	if (!town) return world;
	const city = planCity(grid, town.railCellIds, occupied);
	for (const cellIds of city.corridors)
		world = applyEdit(world, { kind: 'line', transit: 'viaduct', cellIds });
	const cityStages = city.centres.map(() => 0);
	return growCity({ ...world, state: { ...world.state, city, cityStages } }, applyEdit, true);
}
