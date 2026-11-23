import { citySiteParams, createCitySite, readCityDistricts, readCityGrid } from './index';

export function example() {
	const site = createCitySite();
	const layout = readCityGrid(site, citySiteParams.citySize.default);
	return { ...layout, districts: readCityDistricts(site, layout) };
}
