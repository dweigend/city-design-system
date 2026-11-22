import { expect, test } from 'bun:test';
import { citySiteParams, cityWindow, createCitySite, readCityGrid, createCityPlan } from './index';
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

test('raises the same terrace cells over true-height terrain and retains their heights through growth', () => {
	const city = createCitySite();
	const initial = createCityPlan(city, citySiteParams.citySize.default);
	const grown = createCityPlan(city, citySiteParams.citySize.max);
	const even = initial.readVolume({ height: 30, complexity: 0 });
	const heights = initial.readVolume(undefined);
	const larger = grown.readVolume(undefined);
	const largerHeights = new Map(larger.volume.cells.map(({ id, height }) => [id, height]));
	expect(city.heightScale).toBe(1);
	expect(even).toMatchObject({ maxHeight: 30, medianHeight: 30 });
	expect(heights.medianHeight).toBeLessThan(heights.maxHeight);
	expect(largerHeights.size).toBeGreaterThan(heights.volume.cells.length);
	for (const { id, height } of heights.volume.cells) expect(largerHeights.get(id)).toBe(height);
});

test('keeps a low edge and two limited upper storeys in the chapter default', () => {
	const { volume, maxHeight } = createCityPlan(
		createCitySite(),
		citySiteParams.citySize.default
	).readVolume(undefined);
	const heights = volume.cells.map(({ height }) => height);
	const levels = [...new Set(heights)].sort((a, b) => b - a);
	const upperShare = heights.filter((height) => height >= levels[1]).length / heights.length;
	expect(maxHeight).toBe(32);
	expect(levels.at(-1)).toBe(3);
	expect(levels.length).toBeGreaterThanOrEqual(5);
	expect(upperShare).toBeGreaterThanOrEqual(0.1);
	expect(upperShare).toBeLessThanOrEqual(0.2);
});
