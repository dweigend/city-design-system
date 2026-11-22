import { citySiteParams, createCitySite, readCityGrid } from './index';

export function example() {
	return readCityGrid(createCitySite(), citySiteParams.citySize.default);
}
