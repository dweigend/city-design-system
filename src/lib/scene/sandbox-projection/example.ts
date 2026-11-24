import {
	citySiteParams,
	createCitySite,
	readCityGrid,
	readCityParcels
} from '../../world/city-site';
import { createSandboxProjection } from './index';

/** Displays the default town with one draped parcel outline. */
export function example() {
	const site = createCitySite();
	const layout = readCityGrid(site, citySiteParams.citySize.default);
	const holdings = readCityParcels(site, layout);
	const projection = createSandboxProjection(site, layout, holdings);
	return { projection, parcel: holdings.parcels[0] };
}
