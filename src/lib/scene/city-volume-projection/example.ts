import { CityVolume } from '../../domain/city-volume';
import { TerrainGrid } from '../../domain/terrain-grid';
import { projectCityVolume } from './index';

export function example() {
	const seed = 1201;
	const datum = { origin: [0, 0], bearing: 0, length: 380, width: 152 } as const;
	const heightAt = (_x: number, y: number) => 10 + y * 0.06;
	const plan = TerrainGrid.create({ seed, site: datum, heightAt });
	const volume = CityVolume.create({ seed, plan, datum });
	return {
		plan,
		volume,
		heightAt,
		...projectCityVolume(
			volume,
			plan,
			{ width: datum.length, depth: datum.width },
			(x, y) => [x, y],
			heightAt
		)
	};
}
