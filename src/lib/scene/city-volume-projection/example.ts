import { createCityLattice, createCityProfile, readCityColumns } from '../../domain/city-volume';
import { TerrainGrid } from '../../domain/terrain-grid';
import { projectCityLattice, projectCityProfile } from './index';

export function example() {
	const seed = 1201;
	const datum = { origin: [0, 0], bearing: 0, length: 380, width: 152 } as const;
	const heightAt = (_x: number, y: number) => 10 + y * 0.06;
	const plan = TerrainGrid.create({ seed, site: datum, heightAt });
	const profile = createCityProfile(datum, seed);
	const lattice = createCityLattice(readCityColumns(plan, profile));
	const frame = {
		footprint: { width: datum.length, depth: datum.width },
		toLocal: (x: number, y: number) => [x, y] as const
	};
	return {
		heightAt,
		frame,
		profile,
		lattice,
		surface: projectCityProfile(
			profile,
			[
				[-190, -76],
				[190, -76],
				[190, 76],
				[-190, 76]
			],
			frame,
			heightAt
		),
		members: projectCityLattice(lattice, frame)
	};
}
