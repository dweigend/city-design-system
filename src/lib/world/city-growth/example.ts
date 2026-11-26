import { createCitySite } from '../city-site';
import {
	advanceCityGrowth,
	createCityGrowth,
	defaultCityGrowthRecipe,
	readCitySnapshot
} from './index';

/** Founds a valley village and reads the city at the end of the default schedule. */
export function example() {
	const seed = 1201;
	const site = createCitySite(undefined, { seed });
	const founded = createCityGrowth(site, defaultCityGrowthRecipe, seed);
	return readCitySnapshot(advanceCityGrowth(founded, defaultCityGrowthRecipe.endYear));
}
