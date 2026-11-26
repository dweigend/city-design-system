import { createCitySite } from '../city-site';
import {
	advanceCityGrowth,
	createCityGrowth,
	createSandboxHandover,
	defaultCityGrowthRecipe,
	readCitySnapshot,
	type CityGrowthRecipe
} from './index';

/** Follows a seeded village through public works, stock changes and the 2030 handover. */
export function example() {
	const seed = 1201;
	const site = createCitySite(undefined, { seed });
	const recipe: CityGrowthRecipe = {
		...defaultCityGrowthRecipe,
		development: {},
		stockChanges: [
			{ kind: 'infill', year: 1970, storeys: 2, use: 'workshop' },
			{ kind: 'convert', year: 2010, fromUse: 'workshop', use: 'office' }
		]
	};
	const founded = createCityGrowth(site, recipe, seed);
	const run = advanceCityGrowth(founded, recipe.endYear);
	const handover = createSandboxHandover(run);
	return { snapshot: readCitySnapshot(run), sandbox: handover.serialize(handover.document) };
}
