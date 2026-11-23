import {
	createCityDistricts,
	createCityLattice,
	createCityTaper,
	readCityColumns
} from '../../domain/city-volume';
import { TerrainGrid } from '../../domain/terrain-grid';
import { projectCityDistricts, projectCityLattice } from './index';

export function example() {
	const seed = 1201;
	const site = { origin: [0, 0], bearing: 0, length: 2600, width: 1300 } as const;
	const datumZ = 10;
	const heightAt = (_x: number, y: number) => datumZ + y * 0.002;
	const plan = TerrainGrid.create({
		seed,
		site,
		variant: 'square',
		heightAt,
		parameters: { cellSize: 60 }
	});
	const districts = createCityDistricts(
		plan,
		{ origin: site.origin, bearing: 0, aspect: 0.5 },
		seed
	);
	const columns = readCityColumns(plan, districts);
	const lattice = createCityLattice(columns, datumZ, 'square');
	const taper = createCityTaper(columns, datumZ);
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
		taper,
		envelope: projectCityDistricts(columns, datumZ, frame, taper, seed),
		members: projectCityLattice(lattice, frame, taper)
	};
}
