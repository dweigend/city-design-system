import { citySiteParams, createCitySite, readCityGrid } from './index';

export function example() {
	return readCityGrid(createCitySite(), citySiteParams.siteSize.default, 5);
}
