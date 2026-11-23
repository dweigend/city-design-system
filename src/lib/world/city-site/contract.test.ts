import { expect, test } from 'bun:test';
import { required } from '../../core/invariant';
import {
	cityLatticesByPlan,
	cityPlanVariants,
	createCityLattice,
	levelHeight,
	readCityColumns,
	type CityColumn,
	type CityLattice
} from '../../domain/city-volume';
import type { TerrainGrid } from '../../domain/terrain-grid';
import {
	citySiteParams,
	cityWindow,
	createCitySite,
	readCityDistricts,
	readCityGrid
} from './index';
import { example } from './example';

test('places a seeded city on the upper terrace and grows it without moving cells', () => {
	const city = createCitySite();
	const { default: size } = citySiteParams.citySize;
	const initial = example();
	const larger = readCityGrid(city, size + 800);
	const cells = new Map(larger.grid.cells.map((cell) => [cell.id, cell]));
	expect(city.valley.seed).toBe(1201);
	expect(city.datumZ).toBe(19);
	expect(initial.medianCellSize).toBeGreaterThan(50);
	expect(initial.medianCellSize).toBeLessThan(70);
	expect(initial).toEqual(readCityGrid(city, size));
	expect(readCityGrid(city, size, 'organic', 7).grid).not.toEqual(initial.grid);
	expect(cityWindow(city, size + 800).length).toBeGreaterThan(cityWindow(city, size).length);
	for (const { id, vertexIds, neighbors } of initial.grid.cells) {
		expect(cells.get(id)?.vertexIds).toEqual(vertexIds);
		neighbors.forEach((neighbor, i) => {
			if (neighbor !== null) expect(cells.get(id)?.neighbors[i]).toBe(neighbor);
		});
	}
	for (const { position } of initial.grid.vertices) {
		const [x, y, z] = position;
		const { height, bank } = city.valley.sampleGround(x, y);
		expect(z).toBe(height);
		expect(bank).toBeGreaterThan(0);
		expect(Math.abs(z - city.datumZ)).toBeLessThan(levelHeight / 2);
	}
});

test('reads a village, a town and a city from the outline length', () => {
	const city = createCitySite();
	const classes = [
		[1200, 'village', ['detached']],
		[2600, 'town', ['block', 'detached']],
		[6000, 'city', ['block', 'center', 'detached']]
	] as const;
	for (const [length, settlement, kinds] of classes) {
		const { grid, areaKm2 } = readCityGrid(city, length, 'square');
		const districts = readCityDistricts(city, grid);
		expect(districts.settlement).toBe(settlement);
		expect(districts.areaKm2).toBeCloseTo(areaKm2, 9);
		const present = new Set(readCityColumns(grid, districts).map(({ kind }) => kind));
		expect([...present].sort()).toEqual([...kinds]);
	}
	const largest = readCityGrid(city, citySiteParams.citySize.max, 'square');
	expect(largest.areaKm2).toBeGreaterThan(7.5);
	expect(readCityDistricts(city, largest.grid).peakHeight).toBe(140);
});

function assertTiled(grid: TerrainGrid) {
	const sides = new Map<string, { id: string; neighbor: string | null; from: string }[]>();
	for (const { id, vertexIds, neighbors } of grid.cells) {
		for (const [i, from] of vertexIds.entries()) {
			const key = JSON.stringify([from, vertexIds[(i + 1) % vertexIds.length]].sort());
			const copies = sides.get(key) ?? [];
			copies.push({ id, neighbor: neighbors[i], from });
			sides.set(key, copies);
		}
	}
	const boundary = new Set(grid.boundary.map(([from, to]) => JSON.stringify([from, to].sort())));
	for (const [key, copies] of sides) {
		const [a, b] = copies;
		expect(copies.length).toBe(boundary.has(key) ? 1 : 2);
		expect(a.neighbor).toBe(b?.id ?? null);
		if (b) {
			expect(b.neighbor).toBe(a.id);
			expect(b.from).not.toBe(a.from);
		}
	}
	// A connected planar tiling has Euler characteristic 1 exactly when it has no internal holes.
	expect(grid.vertices.length - sides.size + grid.cells.length).toBe(1);
}

function assertDistricts(columns: readonly CityColumn[]) {
	const groups = new Map<string, CityColumn[]>();
	const byId = new Map(columns.map((column) => [column.planCellId, column]));
	for (const column of columns) {
		const group = groups.get(column.districtId) ?? [];
		group.push(column);
		groups.set(column.districtId, group);
	}
	for (const group of groups.values()) {
		const [first] = group;
		const queue = [first];
		const reached = new Set([first.planCellId]);
		for (const { kind, levels, neighbors } of queue) {
			expect(kind).toBe(first.kind);
			if (kind === 'block') expect(levels).toBe(3);
			if (kind === 'detached') expect(levels).toBe(1);
			for (const id of neighbors) {
				const neighbor = id === null ? undefined : byId.get(id);
				if (neighbor?.districtId !== first.districtId || reached.has(neighbor.planCellId)) continue;
				reached.add(neighbor.planCellId);
				queue.push(neighbor);
			}
		}
		expect(queue).toHaveLength(group.length);
	}
	return [...groups.values()].map(([column]) => column.kind).sort();
}

function assertCarrier(columns: readonly CityColumn[], lattice: CityLattice, datumZ: number) {
	const nodes = new Map(lattice.nodes.map((node) => [node.id, node.position]));
	const edges = new Set(lattice.edges.map(({ id }) => id));
	const bays = new Map(lattice.cells.map((cell) => [cell.id, cell]));
	const faces = new Map(lattice.faces.map((face) => [face.id, face]));
	expect(new Set(lattice.nodes.map(({ position }) => position.join(','))).size).toBe(nodes.size);
	expect(nodes.size).toBe(lattice.nodes.length);
	expect(edges.size).toBe(lattice.edges.length);
	expect(faces.size).toBe(lattice.faces.length);
	expect(lattice.cells.length).toBe(columns.reduce((sum, column) => sum + column.levels, 0));
	for (const column of columns) {
		const { planCellId, corners, levels, neighbors } = column;
		expect(levels).toBeGreaterThanOrEqual(1);
		for (let level = 0; level < levels; level++) {
			const cell = required(bays.get(`${planCellId}/level/${level}`), 'carrier bay');
			expect(cell.sideFaces).toHaveLength(corners.length);
			for (const [side, faceId] of cell.sideFaces.entries()) {
				const neighbor = bays.get(`${neighbors[side]}/level/${level}`);
				if (neighbor) expect(neighbor.sideFaces).toContain(faceId);
				const boundary = required(faces.get(faceId), 'carrier face').corners;
				for (const [i, from] of boundary.entries()) {
					const to = boundary[(i + 1) % boundary.length];
					expect(edges.has(JSON.stringify([from, to].sort()))).toBe(true);
				}
				const [a, b] = [corners[side], corners[(side + 1) % corners.length]];
				expect(boundary.slice(0, 2).sort()).toEqual(
					[a, b].map(({ id }) => `vertex/${id}/level/${level}`).sort()
				);
				for (const corner of [a, b]) {
					expect(nodes.get(`vertex/${corner.id}/level/0`)).toEqual(corner.position);
					expect(nodes.get(`vertex/${corner.id}/level/${level + 1}`)).toEqual([
						corner.position[0],
						corner.position[1],
						datumZ + (level + 1) * levelHeight
					]);
				}
			}
		}
	}
}

const city = createCitySite();
for (const plan of cityPlanVariants) {
	const town = readCityGrid(city, 2600, plan).grid;
	const columns = readCityColumns(
		town,
		readCityDistricts(city, town, undefined, { complexity: 1 })
	);

	test(`${plan} tiles a town without holes and keeps connected districts`, () => {
		assertTiled(town);
		expect(assertDistricts(columns)).toContain('block');
	});

	test(`${plan} shares every side up to the lower column in all lattices`, () => {
		for (const frame of cityLatticesByPlan[plan]) {
			const lattice = createCityLattice(columns, city.datumZ, plan, frame);
			assertCarrier(columns, lattice, city.datumZ);
		}
	});
}
