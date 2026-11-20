import { townGrid } from './town-grid';
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
	const walkOccupied = new Set([
		...state.stacks.keys(),
		...protectedIds,
		...[...state.cover].filter(([, cover]) => cover === 'forest').map(([id]) => id)
	]);
	const city = planCity(grid, town.railCellIds, occupied, walkOccupied);
	for (const c of city.centres)
		for (const id of c.green.planting)
			if (!state.cover.has(id))
				world = applyEdit(world, {
					kind: 'cover',
					cellId: id,
					cover: c.green.cells.includes(id) ? 'meadow' : 'field'
				});
	const bodies = [
		...state.stacks.keys(),
		...city.centres.flatMap((c) => [
			c.landmark.cellId,
			...c.lots,
			...c.ensembles.flatMap((g) => g.plaza?.cells ?? [])
		])
	];
	const thresholds = city.centres.flatMap((centre) =>
		centre.ensembles.flatMap((court) =>
			court.lots
				.filter((id) => grid.cellsById.get(id)?.neighbors.includes(court.court))
				.map((id) => [court.court, id])
		)
	);
	const walks = [...city.walk, ...thresholds];
	for (const link of city.corridors) {
		const cellIds = clearCourse(grid, link, bodies, walks);
		if (cellIds) world = applyEdit(world, { kind: 'line', transit: 'viaduct', cellIds });
	}
	const cityStages = city.centres.map(() => 0);
	return growCity(
		{ ...world, grid: townGrid(world.grid, city.walk), state: { ...world.state, city, cityStages } },
		applyEdit,
		true
	);
}
