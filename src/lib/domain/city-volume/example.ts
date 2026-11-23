import { TerrainGrid } from '../terrain-grid';
import { createCityDistricts, createCityLattice, readCityColumns } from './index';

export function example() {
	const seed = 1201;
	const site = { origin: [0, 0], bearing: 0, length: 380, width: 152 } as const;
	const plan = TerrainGrid.create({
		seed,
		site,
		variant: 'hex',
		heightAt: (_x, y) => y * 0.06
	});
	const districts = createCityDistricts(plan, site.origin, seed);
	const columns = readCityColumns(plan, districts);
	return { districts, columns, lattice: createCityLattice(columns, 0, 'hex', 'braced') };
}
