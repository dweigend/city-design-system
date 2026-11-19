import { planCity, type CityPlan } from '../city-plan';
import { planTownForms } from '../town-forms';
import { applyEdit, type World } from './world';
import { cityHouseStyle, growCity } from './city-growth';

type Town = NonNullable<ReturnType<typeof planTownForms>>;

function seedTownSites(world: World, city: CityPlan, sites: Town['satellite']) {
	for (const { cellId, stories } of sites) {
		const cell = world.grid.cellsById.get(cellId);
		if (!cell) continue;
		const style = cityHouseStyle(world, city, cell);
		for (const use of stories) world = applyEdit(world, { kind: 'raise', cellId, use, style });
	}
	return world;
}

function surveyOpening(world: World, occupied: Set<string>) {
	const rail = world.state.lines.find((line) => line.transit === 'viaduct');
	if (rail) return { rail: rail.cellIds, sites: [], existing: true };
	const town = planTownForms(world.grid, world.seed, occupied);
	if (town)
		return {
			rail: town.railCellIds,
			sites: [...town.runs.flat(), ...town.satellite],
			existing: false
		};
}

/** Establishes city districts around the editable opening's surveyed rail terminals. */
export function openCity(world: World, protectedIds: readonly string[] = []): World {
	const { grid, state } = world;
	const occupied = new Set([...state.stacks.keys(), ...state.cover.keys(), ...protectedIds]);
	const survey = surveyOpening(world, occupied);
	if (!survey || survey.rail.length !== 2) return world;
	for (const site of survey.sites) occupied.add(site.cellId);
	const city = planCity(grid, [survey.rail[0], survey.rail[1]], occupied);
	world = seedTownSites(world, city, survey.sites);
	for (const cellIds of city.corridors.slice(Number(survey.existing)))
		world = applyEdit(world, { kind: 'line', transit: 'viaduct', cellIds });
	const cityStages = city.centres.map(() => 0);
	return growCity({ ...world, state: { ...world.state, city, cityStages } }, applyEdit, true);
}
