import { expect, test } from 'bun:test';
import { required } from '../../core/invariant';
import { TerrainGrid } from '../terrain-grid';
import {
	cityLatticesByPlan,
	createCityDistricts,
	createCityLattice,
	districtLevels,
	maximumLevelStep,
	readCityColumns,
	settlementThresholds,
	storeysPerLevel,
	type CityColumn
} from './index';
import { example } from './example';

const core = { origin: [0, 0], bearing: 0, aspect: 0.5 } as const;

function flatPlan(length: number, seed = 1201) {
	const site = { origin: [0, 0], bearing: 0, length, width: length / 2 } as const;
	return TerrainGrid.create({
		seed,
		site,
		variant: 'square',
		heightAt: () => 0,
		parameters: { cellSize: 60 }
	});
}

function kindsOf(plan: TerrainGrid, districts: ReturnType<typeof createCityDistricts>) {
	return new Set(readCityColumns(plan, districts).map(({ kind }) => kind));
}

test('derives district kinds and the peak from the built-up area of the plan', () => {
	const village = flatPlan(1000);
	const town = flatPlan(2000);
	const city = flatPlan(3800);
	const at = (plan: TerrainGrid) => createCityDistricts(plan, core, 1201);
	expect(at(village).settlement).toBe('village');
	expect([...kindsOf(village, at(village))]).toEqual(['detached']);
	expect(at(village).peakHeight).toBe(7);
	expect(at(town).settlement).toBe('town');
	expect([...kindsOf(town, at(town))].sort()).toEqual(['block', 'detached']);
	expect(at(town).peakHeight).toBe(21);
	expect(at(city).settlement).toBe('city');
	expect([...kindsOf(city, at(city))].sort()).toEqual(['block', 'center', 'detached']);
	expect(at(city).peakHeight).toBeGreaterThan(42);
	expect(settlementThresholds).toEqual({ town: 1, city: 3 });
	const capped = createCityDistricts(city, core, 1201, { height: 49 });
	expect(capped.peakHeight).toBe(49);
	expect(example().lattice.cells.length).toBeGreaterThan(0);
});

test('grades the center and bounds the step between neighboring columns', () => {
	const plan = flatPlan(3800);
	const columns = readCityColumns(plan, createCityDistricts(plan, core, 1201));
	const byId = new Map(columns.map((column) => [column.planCellId, column]));
	const center = columns.filter(({ kind }) => kind === 'center');
	const heights = new Set(center.map(({ levels }) => levels));
	expect(heights.size).toBeGreaterThan(3);
	expect(Math.min(...heights)).toBe(districtLevels.block);
	for (const { levels, neighbors } of columns) {
		for (const id of neighbors) {
			if (id === null) continue;
			const neighbor = required(byId.get(id), 'neighbor column');
			expect(Math.abs(neighbor.levels - levels)).toBeLessThanOrEqual(maximumLevelStep);
		}
	}
	const peak = Math.max(...heights);
	expect(center.filter(({ levels }) => levels === peak).length).toBeLessThan(center.length / 4);
});

test('repeats a seed exactly and only converts cells upward as the plan grows', () => {
	const order = { detached: 0, block: 1, center: 2 };
	const sizes = [1800, 2400, 3000, 3800];
	let previous: Map<string, CityColumn> | undefined;
	for (const length of sizes) {
		const plan = flatPlan(length);
		const columns = readCityColumns(plan, createCityDistricts(plan, core, 77));
		expect(readCityColumns(plan, createCityDistricts(plan, core, 77))).toEqual(columns);
		for (const column of columns) {
			const before = previous?.get(column.planCellId);
			if (!before) continue;
			expect(order[column.kind]).toBeGreaterThanOrEqual(order[before.kind]);
			if (column.kind === before.kind && column.kind !== 'center')
				expect(column.levels).toBe(before.levels);
		}
		previous = new Map(columns.map((column) => [column.planCellId, column]));
	}
	const other = flatPlan(3800);
	expect(
		readCityColumns(other, createCityDistricts(other, core, 78)).map(({ kind }) => kind)
	).not.toEqual(
		readCityColumns(other, createCityDistricts(other, core, 77)).map(({ kind }) => kind)
	);
});

test('uses the same prism faces for all square frames, including a terrain-fitting first bay', () => {
	const corners = [
		{ id: 'a', position: [0, 0, 0] },
		{ id: 'b', position: [14, 0, 1] },
		{ id: 'c', position: [14, 14, 2] },
		{ id: 'd', position: [0, 14, 3] }
	] as const;
	const columns = [
		{
			planCellId: 'square',
			corners,
			neighbors: [null, null, null, null],
			districtId: 'detached/0',
			kind: 'detached',
			levels: 1
		}
	] as const;
	const [box, braced, centered, tetrahedral] = cityLatticesByPlan.square.map((frame) =>
		createCityLattice(columns, 10, 'square', frame)
	);
	for (const lattice of [braced, centered, tetrahedral]) {
		expect(lattice.cells).toEqual(box.cells);
		expect(lattice.faces).toEqual(box.faces);
	}
	expect(box.edges).toHaveLength(12);
	expect(braced.edges).toHaveLength(16);
	expect(centered.edges).toHaveLength(20);
	expect(tetrahedral.edges).toHaveLength(19);
	expect(box.nodes.find(({ id }) => id === 'vertex/b/level/0')?.position).toEqual([14, 0, 1]);
	expect(box.nodes.find(({ id }) => id === 'vertex/b/level/1')?.position).toEqual([14, 0, 17]);
	expect(centered.nodes.find(({ id }) => id.endsWith('/center'))?.position).toEqual([7, 7, 9.25]);
	const sloped = createCityLattice(columns, -4, 'square');
	expect(sloped.nodes.find(({ id }) => id === 'vertex/d/level/0')?.position).toEqual([0, 14, 3]);
	expect(sloped.nodes.find(({ id }) => id === 'vertex/d/level/2')?.position).toEqual([0, 14, 10]);
});

test('rejects malformed columns before allocating bays', () => {
	const column: CityColumn = {
		planCellId: 'cell',
		districtId: 'center/0',
		kind: 'center',
		levels: 1,
		corners: [
			{ id: 'a', position: [0, 0, 0] },
			{ id: 'b', position: [60, 0, 0] },
			{ id: 'c', position: [0, 60, 0] }
		],
		neighbors: [null, null, null]
	};
	for (const levels of [Infinity, NaN, 1.5, 0, -1, 16])
		expect(() => createCityLattice([{ ...column, levels }], 0, 'triangle')).toThrow(RangeError);
	for (let i = 0; i < 3; i++) {
		const position: [number, number, number] = [0, 0, 0];
		position[i] = i === 1 ? NaN : Infinity;
		const corners = [{ id: 'a', position }, ...column.corners.slice(1)];
		expect(() => createCityLattice([{ ...column, corners }], 0, 'triangle')).toThrow(RangeError);
	}
	expect(createCityLattice([{ ...column, levels: 15 }], 0, 'triangle').cells.length).toBe(15);
	expect(storeysPerLevel).toBe(2);
});

test('preserves built area when a plan is translated and defines the empty profile', () => {
	for (const offset of [0, 999_999_900]) {
		const origin = [offset, offset] as const;
		const plan = TerrainGrid.create({
			seed: 1201,
			site: { origin, bearing: 0, length: 10, width: 10 },
			variant: 'square',
			parameters: { cellSize: 5 },
			heightAt: () => 0
		});
		expect(plan.cells.length).toBeGreaterThan(0);
		const oneCell = TerrainGrid.select(plan, [plan.cells[0].id]);
		expect(createCityDistricts(oneCell, { ...core, origin }, 1201).areaKm2).toBe(25 / 1e6);
		const empty = createCityDistricts(TerrainGrid.select(plan, []), { ...core, origin }, 1201);
		expect(empty.areaKm2).toBe(0);
		expect(empty.peakHeight).toBe(0);
		expect(empty.shares).toEqual({ detached: 0, block: 0, center: 0 });
	}
});
