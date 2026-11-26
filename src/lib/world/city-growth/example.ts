import { createCitySite } from '../city-site';
import {
	advanceCityGrowth,
	createCityGrowth,
	defaultCityGrowthRecipe,
	readCitySnapshot,
	type CityGrowthRecipe
} from './index';

/** Founds a valley village and follows a rear wing, upper addition and change of use. */
export function example() {
	const seed = 1201;
	const site = createCitySite(undefined, { seed });
	const recipe: CityGrowthRecipe = {
		...defaultCityGrowthRecipe,
		stockChanges: [
			{ kind: 'infill', year: 1970, storeys: 2, use: 'workshop' },
			{ kind: 'extend', year: 1990, storeys: 3 },
			{ kind: 'convert', year: 2010, fromUse: 'workshop', use: 'office' }
		]
	};
	const founded = createCityGrowth(site, recipe, seed);
	return readCitySnapshot(advanceCityGrowth(founded, recipe.endYear));
}
