import { required } from '../../core/invariant';
import { createCityLattice, readCityColumns } from '../../domain/city-volume';
import { createCitySite, citySiteParams, readCityDistricts, readCityGrid } from '../city-site';

/** A connected group of columns near the first town block, in breadth-first plan order. */
function quarter(columns: ReturnType<typeof readCityColumns>) {
	const byId = new Map(columns.map((column) => [column.planCellId, column]));
	const first = required(columns.find(({ kind }) => kind === 'block') ?? columns[0], 'town block');
	const result = [first];
	const seen = new Set([first.planCellId]);
	const count = Math.ceil(columns.length / 4);
	for (let i = 0; i < result.length && result.length < count; i++) {
		for (const id of result[i].neighbors) {
			if (id === null || seen.has(id)) continue;
			result.push(required(byId.get(id), 'neighboring town column'));
			seen.add(id);
			if (result.length === count) break;
		}
	}
	return result;
}

function settlement(size: number) {
	const city = createCitySite();
	const layout = readCityGrid(city, size);
	const columns = readCityColumns(layout.grid, readCityDistricts(city, layout));
	return { city, layout, columns };
}

/** Reads the default organic town and one connected quarter from its existing columns. */
export function structureTownExample() {
	const town = settlement(citySiteParams.citySize.default);
	return { ...town, quarter: quarter(town.columns) };
}

/** Largest organic envelope on the default site, using the requested lattice model. */
export function largestStructureExample(variant: Parameters<typeof createCityLattice>[3]) {
	const { layout, columns } = settlement(citySiteParams.citySize.max);
	const { datumZ } = layout;
	return { lattice: createCityLattice(columns, datumZ, layout.variant, variant), datumZ };
}
