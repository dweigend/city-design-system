import { expect, test } from 'bun:test';
import { createCitySite, readCityGrid } from './index';
import { example } from './example';

test('places a repeatable grid on the chapter valley while keeping the window fixed', () => {
	const city = createCitySite();
	const initial = example();
	const larger = readCityGrid(city, 440, 5);
	const cellIds = new Set(larger.grid.cells.map(({ id }) => id));
	expect(city.valley.seed).toBe(1201);
	expect(initial.grid.cells.length).toBeGreaterThan(100);
	expect(larger.grid.cells.length).toBeGreaterThan(initial.grid.cells.length);
	expect(initial.grid.cells.every(({ id }) => cellIds.has(id))).toBe(true);
	expect(initial).toEqual(readCityGrid(city, initial.site.length, 5));
	for (const {
		position: [x, y, z]
	} of initial.grid.vertices) {
		const { height, bank } = city.valley.sampleGround(x, y);
		expect(z).toBe(height);
		expect(bank).toBeGreaterThan(0);
	}
});
