import { readCityColumns } from '../../domain/city-volume';
import {
	citySiteParams,
	createCitySite,
	readCityDistricts,
	readCityGrid,
	type CityPlanVariant,
	type CitySiteOptions
} from '../city-site';
import {
	createCityRailSurvey,
	readCityCrossingHeads,
	readCityMovement,
	readCityRail
} from './index';

/** Builds a seeded valley settlement with walkway centres and rail catchments supplied by the caller. */
export function cityMovementExample(
	variant: CityPlanVariant = 'organic',
	size = citySiteParams.citySize.default,
	relief?: number,
	useCrossing = true,
	recipe?: CitySiteOptions['recipe']
) {
	const site = createCitySite(undefined, { ...(relief === undefined ? {} : { relief }), recipe });
	const layout = readCityGrid(site, size, variant);
	const columns = readCityColumns(layout.grid, readCityDistricts(site, layout));
	const heads = useCrossing ? readCityCrossingHeads(layout) : [];
	const survey = createCityRailSurvey(site, layout, heads);
	const { center } = survey;
	const rail = readCityRail(site, layout, columns, {
		...survey,
		catchments: [
			{ id: 'north', center: [center[0], center[1] + 350] },
			{ id: 'south', center: [center[0], center[1] - 350] }
		]
	});
	const movement = readCityMovement(site, layout, columns, 0, rail, heads);
	return { site, layout, columns, rail, heads, ...movement };
}
