import { readCityColumns, type CityPlanVariant } from '../../domain/city-volume';
import { citySiteParams, createCitySite, readCityDistricts, readCityGrid } from '../city-site';
import { readCityMovement, readCityRail } from './index';

/** Builds a seeded valley settlement and its shared walking and rail infrastructure. */
export function cityMovementExample(
	variant: CityPlanVariant,
	size = citySiteParams.citySize.default as number,
	relief?: number
) {
	const site = createCitySite(undefined, relief === undefined ? undefined : { relief });
	const layout = readCityGrid(site, size, variant);
	const columns = readCityColumns(layout.grid, readCityDistricts(site, layout));
	const rail = readCityRail(site, layout, columns);
	return { site, layout, columns, rail, ...readCityMovement(site, layout, columns, 0, rail) };
}
