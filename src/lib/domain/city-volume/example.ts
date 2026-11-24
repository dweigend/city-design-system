import { TerrainGrid } from '../terrain-grid';
import {
	createCityDistricts,
	createCityLattice,
	createLatticeBayObject,
	readCityColumns,
	subdivideBay
} from './index';

export function example() {
	const seed = 1201;
	const site = { origin: [0, 0], bearing: 0, length: 2600, width: 1300 } as const;
	const plan = TerrainGrid.create({
		seed,
		site,
		variant: 'hex',
		heightAt: (_x, y) => y * 0.002,
		parameters: { cellSize: 40 }
	});
	const core = { origin: site.origin, bearing: site.bearing, aspect: 0.5 };
	const districts = createCityDistricts(plan, core, seed);
	const columns = readCityColumns(plan, districts);
	const lattice = createCityLattice(columns, 0, 'braced');
	const bay = lattice.cells[0];
	const floor = lattice.faces.find(({ id }) => id === bay.floorFace);
	return {
		districts,
		columns,
		lattice,
		floor,
		object: createLatticeBayObject(lattice, bay.id),
		children: subdivideBay(bay)
	};
}
