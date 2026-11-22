import { TerrainGrid } from '../terrain-grid';
import { CityVolume } from './index';

export function example() {
	const seed = 1201;
	const datum = { origin: [0, 0], bearing: 0 } as const;
	const plan = TerrainGrid.create({
		seed,
		site: { ...datum, length: 420, width: 180 },
		parameters: { cellSize: 40 },
		heightAt: (_x, y) => y * 0.06
	});
	return CityVolume.create({ plan, datum, seed, parameters: { height: 30, complexity: 1 } });
}
