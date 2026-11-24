import { expect, test } from 'bun:test';
import { shorelineMorphLimits } from '../src/lib/domain/terrain-grid';
import { cityPlanVariants, createCitySite, readCityGrid } from '../src/lib/world/city-site';
import { shoreMetrics } from './city-study-shore';

const cases = [
	{ seed: 1201, relief: 0, runoff: 1 },
	{ seed: 42, relief: 0, runoff: 1 },
	{ seed: 42, relief: 0.75, runoff: 1.5 },
	{ seed: 42, relief: 1, runoff: 0.5 }
];

for (const variant of cityPlanVariants) {
	test(`${variant} meets the shoreline fit targets across the terrain matrix`, () => {
		let shoreCells = 0;
		let clippedCells = 0;
		let bankEdges = 0;
		let alignedEdges = 0;
		for (const settings of cases) {
			const city = createCitySite(undefined, settings);
			const layout = readCityGrid(city, 2600, variant, settings.seed);
			const row = shoreMetrics(layout, city.sampleGround);
			expect(row.occupiedShore).toBeGreaterThan(0);
			expect(row.shoreEdges).toBeGreaterThan(0);
			shoreCells += row.occupiedShore;
			clippedCells += row.clipped;
			bankEdges += row.shoreEdges;
			alignedEdges += row.alignedEdges;
		}
		expect(1 - clippedCells / shoreCells).toBeGreaterThanOrEqual(
			shorelineMorphLimits.targetUnclippedShare
		);
		expect(alignedEdges / bankEdges).toBeGreaterThanOrEqual(
			shorelineMorphLimits.targetAlignedEdgeShare
		);
	}, 30_000);
}
