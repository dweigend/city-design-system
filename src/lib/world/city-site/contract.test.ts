import { expect, test } from 'bun:test';
import { createCityLattice, readCityColumns } from '../../domain/city-volume';
import { planVariants } from '../../domain/terrain-grid';
import { citySiteParams, cityWindow, createCitySite, readCityGrid, readCityProfile } from './index';
import { example } from './example';

test('grows the seeded city along its terrace without moving existing cells', () => {
	const city = createCitySite();
	const { min, max, default: size } = citySiteParams.citySize;
	const initial = example();
	const smaller = readCityGrid(city, min);
	const larger = readCityGrid(city, max);
	const cells = new Map(larger.grid.cells.map((cell) => [cell.id, cell]));
	expect(city.valley.seed).toBe(1201);
	expect(initial.grid.cells.length).toBeGreaterThanOrEqual(30);
	expect(initial.grid.cells.length).toBeLessThanOrEqual(60);
	expect(smaller.grid.cells.length).toBeLessThan(initial.grid.cells.length);
	expect(larger.grid.cells.length).toBeGreaterThan(150);
	expect(cityWindow(city, max).length).toBeGreaterThan(cityWindow(city, size).length);
	expect(initial).toEqual(readCityGrid(city, size));
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

for (const variant of planVariants) {
	test(`${variant} retains the chapter's actual terrace cells and levels as it grows`, () => {
		const city = createCitySite();
		const profile = readCityProfile(city);
		const { min, default: size, max } = citySiteParams.citySize;
		const latticeAt = (length: number) =>
			createCityLattice(readCityColumns(readCityGrid(city, length, variant).grid, profile));
		const small = latticeAt(min);
		const initial = latticeAt(size);
		const grown = new Set(latticeAt(max).cells.map(({ id }) => id));
		expect(profile.height(...profile.summit)).toBeCloseTo(120);
		expect(initial.cells.length).toBeGreaterThan(small.cells.length);
		for (const { id } of [...small.cells, ...initial.cells]) expect(grown.has(id)).toBe(true);
	});
}
