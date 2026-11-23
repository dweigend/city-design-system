import { createCityDistricts, createCityLattice, readCityColumns } from '../../domain/city-volume';
import { TerrainGrid } from '../../domain/terrain-grid';
import { projectCityDistricts, projectCityLattice } from './index';

export function example() {
	const seed = 1201;
	const site = { origin: [0, 0], bearing: 0, length: 380, width: 152 } as const;
	const datumZ = 10;
	const heightAt = (_x: number, y: number) => datumZ + y * 0.06;
	const plan = TerrainGrid.create({ seed, site, variant: 'square', heightAt });
	const districts = createCityDistricts(plan, site.origin, seed);
	const columns = readCityColumns(plan, districts);
	const lattice = createCityLattice(columns, datumZ, 'square');
	const frame = {
		footprint: { width: site.length, depth: site.width },
		toLocal: (x: number, y: number) => [x, y] as const
	};
	return {
		heightAt,
		datumZ,
		frame,
		districts,
		columns,
		lattice,
		envelope: projectCityDistricts(columns, datumZ, frame),
		members: projectCityLattice(lattice, frame)
	};
}
