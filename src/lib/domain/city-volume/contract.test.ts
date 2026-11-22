import { expect, test } from 'bun:test';
import { required } from '../../core/invariant';
import { TerrainGrid } from '../terrain-grid';
import { CityVolume, storeyHeight } from './index';
import { example } from './example';

// Same seeds and growth rectangle as the terrain-grid contract.
const seeds = [0, 1, 7, 42, 1201, 1301, 1409, 65537, 4294967295];
const datum = { origin: [12, 16], bearing: 0.31 } as const;

function plan(seed = 1201, length = 96, width = 64, cellSize = 5) {
	return TerrainGrid.create({
		seed,
		site: { ...datum, length, width },
		parameters: { cellSize },
		heightAt: (x, y) => 11 + 0.026 * x + 0.058 * y
	});
}

test('repeats detached frozen cells and reports each shared edge from both sides', () => {
	const grid = structuredClone(plan());
	const source = { plan: grid, datum, seed: 1201, parameters: { height: 32, complexity: 1 } };
	const before = structuredClone(source);
	const result = CityVolume.create(source);
	expect(CityVolume.create(source)).toEqual(result);
	expect(source).toEqual(before);
	expect(result.cells.map(({ id }) => id)).toEqual(grid.cells.map(({ id }) => id));
	const vertices = new Map(grid.vertices.map(({ id, position }) => [id, position]));
	const cells = new Map(result.cells.map((cell) => [cell.id, cell]));
	expect(Object.isFrozen(result.cells)).toBe(true);
	for (const [index, cell] of result.cells.entries()) {
		const ground = grid.cells[index];
		expect(cell.base).toEqual(
			ground.vertexIds.map((id) => required(vertices.get(id), 'plan vertex'))
		);
		expect(cell.base[0]).not.toBe(vertices.get(ground.vertexIds[0]));
		expect(Object.isFrozen(cell.base[0])).toBe(true);
		expect(Object.isFrozen(cell.edges)).toBe(true);
		for (const [edge, neighbor] of cell.edges.entries()) {
			const id = ground.neighbors[edge];
			expect(neighbor?.id ?? null).toBe(id);
			if (neighbor) {
				const other = required(cells.get(neighbor.id), 'volume neighbor');
				expect(neighbor.heightDifference).toBe(other.height - cell.height);
				expect(Object.isFrozen(neighbor)).toBe(true);
			}
		}
	}
});

test('keeps every old cell height and base when the grid crop grows', () => {
	const options = { seed: 1201, datum, parameters: { height: 32, complexity: 1 } };
	const small = CityVolume.create({ ...options, plan: plan() });
	const large = CityVolume.create({ ...options, plan: plan(1201, 161, 113) });
	const larger = new Map(large.cells.map((cell) => [cell.id, cell]));
	expect(small.cells.length).toBeGreaterThan(100);
	expect(larger.size).toBeGreaterThan(small.cells.length);
	for (const { id, height, base } of small.cells)
		expect(larger.get(id)).toMatchObject({ id, height, base });
});

test('shares bounds and supports both a capped top storey and the minimum positive height', () => {
	const options = { plan: plan(), datum, seed: 1201 };
	const heights = (height: number, complexity: number) =>
		new Set(
			CityVolume.create({ ...options, parameters: { height, complexity } }).cells.map(
				(cell) => cell.height
			)
		);
	expect(heights(200, -1)).toEqual(new Set([32]));
	expect(heights(-20, 8)).toEqual(new Set([1]));
	expect([...heights(2.4, 1)]).toHaveLength(1);
	expect([...heights(2.4, 1)][0]).toBeCloseTo(2.4);
	expect(heights(21, 8)).toEqual(heights(21, 1));
	expect(example().cells.length).toBeGreaterThan(0);
});

// The full 3–32 m range requires steeper transitions than the former narrower profile.
test('keeps jumps over two storeys to at most 16% of edges across all registered seeds', () => {
	for (const seed of seeds) {
		const grid = plan(seed, 620, 260, 40);
		for (let step = 0; step <= 100; step++) {
			const { cells } = CityVolume.create({
				plan: grid,
				datum,
				seed,
				parameters: { height: 32, complexity: step / 100 }
			});
			const edges = cells.flatMap(({ edges }) => edges.filter((edge) => edge !== null));
			const steep = edges.filter(
				({ heightDifference }) => Math.abs(heightDifference) > 2 * storeyHeight
			);
			expect(steep.length / edges.length).toBeLessThanOrEqual(0.16);
			if (step === 100) {
				const heights = cells.map(({ height }) => height);
				expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThanOrEqual(
					4 * storeyHeight
				);
				expect(
					heights.every(
						(height) =>
							height >= storeyHeight &&
							height <= 32 &&
							(height === 32 || height % storeyHeight === 0)
					)
				).toBe(true);
			}
		}
	}
});

test('rejects invalid numeric inputs and malformed plan topology', () => {
	const grid = plan();
	const source = { plan: grid, datum, seed: 1201 };
	expect(() => CityVolume.create({ ...source, seed: -1 })).toThrow(RangeError);
	expect(() => CityVolume.create({ ...source, datum: { ...datum, bearing: Infinity } })).toThrow(
		RangeError
	);
	expect(() => CityVolume.create({ ...source, parameters: { height: NaN } })).toThrow(RangeError);
	expect(() => CityVolume.create({ ...source, parameters: { complexity: Infinity } })).toThrow(
		RangeError
	);
	expect(() => CityVolume.create({ ...source, plan: { ...grid, vertices: [] } })).toThrow(
		RangeError
	);
	expect(() =>
		CityVolume.create({
			...source,
			plan: { ...grid, cells: [grid.cells[0], ...grid.cells] }
		})
	).toThrow(RangeError);
	expect(() =>
		CityVolume.create({ ...source, plan: { ...grid, cells: grid.cells.slice(0, 1) } })
	).toThrow(RangeError);
});
