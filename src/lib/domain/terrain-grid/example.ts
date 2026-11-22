import { TerrainGrid } from './index';

export function example() {
	return TerrainGrid.create({
		seed: 1201,
		parameters: { cellSize: 5 },
		site: { origin: [0, 0], bearing: 0, length: 80, width: 45 },
		heightAt: (_x, y) => y * 0.06
	});
}
