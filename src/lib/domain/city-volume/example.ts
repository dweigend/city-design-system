import { TerrainGrid } from '../terrain-grid';
import { createCityLattice, createCityProfile, readCityColumns } from './index';

export function example() {
	const seed = 1201;
	const datum = { origin: [0, 0], bearing: 0, length: 380, width: 152 } as const;
	const plan = TerrainGrid.create({
		seed,
		site: datum,
		variant: 'hex',
		heightAt: (_x, y) => y * 0.06
	});
	const profile = createCityProfile(datum, seed);
	const columns = readCityColumns(plan, profile);
	return { profile, columns, lattice: createCityLattice(columns, 'braced') };
}
