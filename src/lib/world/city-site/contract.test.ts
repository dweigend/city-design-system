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
	const { min, default: size, max, step } = citySiteParams.citySize;
	const at = (length: number) => readCityGrid(city, length, plan).grid;
	const initial = at(min);
	const current = at(size);
	const grown = at(max);
	const settings = { complexity: 1 };
	const profile = readCityDistricts(city, initial, settings);
	const columns = readCityColumns(current, profile);

	test(`${plan} tiles each crop and keeps connected districts stable during growth`, () => {
		const quiet = readCityDistricts(city, initial, { complexity: 0 });
		const before = new Map(
			readCityColumns(initial, profile).map((cell) => [cell.planCellId, cell])
		);
		for (let length = min; length <= max; length += step) {
			const grid =
				length === min ? initial : length === max ? grown : length === size ? current : at(length);
			assertTiled(grid);
			expect(assertDistricts(readCityColumns(grid, quiet))).toEqual([
				'block',
				'center',
				'detached'
			]);
			const now = readCityColumns(grid, profile);
			for (const cell of now) {
				const previous = before.get(cell.planCellId);
				if (previous) {
					expect(cell).toMatchObject({
						districtId: previous.districtId,
						kind: previous.kind,
						levels: previous.levels,
						corners: previous.corners
					});
					before.delete(cell.planCellId);
				}
			}
			expect(before.size).toBe(0);
			for (const cell of now) before.set(cell.planCellId, cell);
		}
		const kinds = assertDistricts(columns);
		expect(kinds.filter((kind) => kind === 'center')).toHaveLength(2);
		expect(kinds.filter((kind) => kind === 'block').length).toBeGreaterThan(1);
		expect(readCityColumns(current, readCityDistricts(city, initial, settings))).toEqual(columns);
		for (const height of [35, 140]) {
			const peaks = readCityColumns(current, readCityDistricts(city, initial, { height }));
			expect(Math.max(...peaks.map(({ levels }) => levels)) * levelHeight).toBe(height);
		}
	});

	for (const frame of cityLatticesByPlan[plan]) {
		test(`${plan} × ${frame} shares every side up to the lower column`, () => {
			const lattice = createCityLattice(columns, city.datumZ, plan, frame);
			assertCarrier(columns, lattice, city.datumZ);
			const next = createCityLattice(readCityColumns(grown, profile), city.datumZ, plan, frame);
			for (const key of ['cells', 'faces', 'nodes', 'edges'] as const) {
				const byId = new Map(next[key].map((item) => [item.id, item]));
				for (const item of lattice[key]) expect(byId.get(item.id)).toEqual(item);
			}
		});
	}
}
