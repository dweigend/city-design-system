import { TerrainGrid } from '../../domain/terrain-grid';
import { terrainGridProjection } from './index';

export function example() {
	const terrain = {
		kind: 'mesh',
		positions: [-24, -24, 0, 24, -24, 12, 24, 24, 0, -24, 24, 24],
		indices: [0, 1, 2, 0, 2, 3]
	} as const;
	const grid = TerrainGrid.create({
		seed: 1201,
		site: { origin: [0, 0], bearing: 0, length: 40, width: 40 },
		heightAt: () => 5
	});
	return terrainGridProjection(terrain, (x, y) => [x, y], { width: 48, depth: 48 })(grid);
}
