import { expect, test } from 'bun:test';
import { citySiteParams, cityWindow, createCitySite, readCityGrid } from './index';
import { example } from './example';

test('grows the seeded city along its terrace without moving existing cells', () => {
	const city = createCitySite();
	const { min, max, default: size } = citySiteParams.citySize;
	const initial = example();
	const smaller = readCityGrid(city, min, 40);
	const larger = readCityGrid(city, max, 40);
	const cells = new Map(larger.grid.cells.map((cell) => [cell.id, cell]));
	expect(city.valley.seed).toBe(1201);
	expect(initial.grid.cells.length).toBeGreaterThanOrEqual(30);
	expect(initial.grid.cells.length).toBeLessThanOrEqual(60);
	expect(smaller.grid.cells.length).toBeLessThan(initial.grid.cells.length);
	expect(larger.grid.cells.length).toBeGreaterThan(150);
	expect(cityWindow(city, max).length).toBeGreaterThan(cityWindow(city, size).length);
	expect(initial).toEqual(readCityGrid(city, size, 40));
	for (const { id, vertexIds, neighbors } of initial.grid.cells) {
		expect(cells.get(id)?.vertexIds).toEqual(vertexIds);
		neighbors.forEach((neighbor, i) => {
			if (neighbor !== null) expect(cells.get(id)?.neighbors[i]).toBe(neighbor);
		});
	}
	const vertices = new Map(larger.grid.vertices.map(({ id, position }) => [id, position]));
	for (const { id, position } of initial.grid.vertices) {
		const [x, y, z] = position;
		const { height, bank } = city.valley.sampleGround(x, y);
		expect(z).toBe(height);
		expect(bank).toBeGreaterThan(0);
		expect(vertices.get(id)).toEqual(position);
	}
});
