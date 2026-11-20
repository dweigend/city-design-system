import { planCity } from '../city-plan';
import { planTownForms } from '../town-forms';
import { applyEdit, type World } from './world';
import { clearCourse } from '../transit-line';
import { growCity } from './city-growth';

/** Establishes city districts around the editable opening's surveyed rail terminals. */
export function openCity(world: World, protectedIds: readonly string[] = []): World {
	const { grid, state } = world;
	const occupied = new Set([...state.stacks.keys(), ...state.cover.keys(), ...protectedIds]);
	const town = planTownForms(grid, world.seed, occupied);
	if (!town) return world;
	const city = planCity(grid, town.railCellIds, occupied);
	const bodies = [
		...state.stacks.keys(),
		...city.centres.flatMap((c) => [c.landmark.cellId, ...c.lots])
	];
	const thresholds = city.centres.flatMap((centre) =>
		centre.ensembles.flatMap((court) => court.lots.slice(0, 3).map((id) => [court.court, id]))
	);
	const walks = [...city.walk, ...thresholds];
	for (const link of city.corridors) {
		const cellIds = clearCourse(grid, link, bodies, walks);
		if (cellIds) world = applyEdit(world, { kind: 'line', transit: 'viaduct', cellIds });
	}
	const cityStages = city.centres.map(() => 0);
	return growCity({ ...world, state: { ...world.state, city, cityStages } }, applyEdit, true);
}
