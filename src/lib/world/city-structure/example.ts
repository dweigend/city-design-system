import { createCityLattice, readCityColumns } from '../../domain/city-volume';
import { createCitySite, citySiteParams, readCityDistricts, readCityGrid } from '../city-site';
import { createCityStructure, readStructureQuarter } from './index';

function settlement(size: number) {
	const city = createCitySite();
	const layout = readCityGrid(city, size);
	const columns = readCityColumns(layout.grid, readCityDistricts(city, layout));
	return { layout, columns };
}

/** Reads one connected quarter of the default organic town. */
export function structureTownExample() {
	const { layout, columns } = settlement(citySiteParams.citySize.default);
	return { layout, columns, quarter: readStructureQuarter(columns) };
}

/** Largest organic envelope on the default site, using the requested lattice model. */
export function largestStructureExample(variant: Parameters<typeof createCityLattice>[2]) {
	const { layout, columns } = settlement(citySiteParams.citySize.max);
	const { datumZ } = layout;
	return { lattice: createCityLattice(columns, datumZ, variant), datumZ };
}

/** Builds a braced quarter through the public structure entry. */
export function example() {
	const { layout, quarter } = structureTownExample();
	const { datumZ } = layout;
	return createCityStructure(createCityLattice(quarter, datumZ, 'braced'), datumZ);
}
