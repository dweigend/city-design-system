import { expect, test } from 'bun:test';
import { required } from '../../core/invariant';
import { measurePolygon } from '../../core/geometry';
import {
	cityLatticesByPlan,
	cityPlanVariants,
	createCityLattice,
	columnRoof,
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
	readCitySide,
	readCityDistricts,
	readCityGrid
} from './index';

test('grows on both banks without moving cells or the common datum', () => {
	const city = createCitySite();
	const { default: size } = citySiteParams.citySize;
	const initial = readCityGrid(city, size);
	const larger = readCityGrid(city, size + 800);
	const cells = new Map(larger.grid.cells.map((cell) => [cell.id, cell]));
	expect(city.valley.seed).toBe(1201);
	expect(initial.datumZ).toBe(larger.datumZ);
	expect(initial.medianCellSize).toBeGreaterThan(50);
	expect(initial.medianCellSize).toBeLessThan(70);
	expect(initial).toEqual(readCityGrid(city, size));
	expect(readCityGrid(city, size, 'organic', 7).grid).not.toEqual(initial.grid);
	expect(cityWindow(city, larger.grid).length).toBeGreaterThan(
		cityWindow(city, initial.grid).length
	);
	for (const { id, vertexIds, neighbors } of initial.grid.cells) {
		expect(cells.get(id)?.vertexIds).toEqual(vertexIds);
		neighbors.forEach((neighbor, i) => {
			if (neighbor !== null) expect(cells.get(id)?.neighbors[i]).toBe(neighbor);
		});
	}
	const banks = new Set<number>();
	for (const { position } of initial.grid.vertices) {
		const [x, y, z] = position;
		const { height, bank } = city.valley.readGround(x, y);
		expect(z).toBe(height);
		expect(bank).toBeGreaterThan(0);
		expect(z).toBeGreaterThanOrEqual(initial.datumZ);
		banks.add(readCitySide(city, [x, y]));
	}
	expect(banks).toEqual(new Set([-1, 1]));
}, 15_000);

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
	expect(largest.areaKm2).toBeGreaterThan(9);
	expect(readCityDistricts(city, largest.grid).peakHeight).toBe(105);
}, 15_000);

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
	const unseen = new Set(grid.cells.map(({ id }) => id));
	const byId = new Map(grid.cells.map((cell) => [cell.id, cell]));
	const vertices = new Map(grid.vertices.map(({ id, position }) => [id, position]));
	let parts = 0;
	for (const start of unseen) {
		const queue = [start];
		unseen.delete(start);
		parts++;
		let area = 0;
		for (const id of queue) {
			const { vertexIds, neighbors } = required(byId.get(id), 'city cell');
			area += measurePolygon(
				vertexIds.map((vertex) => required(vertices.get(vertex), 'city vertex'))
			).area;
			for (const neighbor of neighbors) {
				if (neighbor !== null && unseen.delete(neighbor)) queue.push(neighbor);
			}
		}
		expect(area).toBeGreaterThanOrEqual(10_800);
	}
	expect(parts).toBeLessThanOrEqual(8);
	expect(grid.vertices.length - sides.size + grid.cells.length).toBe(parts);
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
	for (const column of columns) {
		const { planCellId, corners, neighbors } = column;
		const first = Math.floor(
			(Math.min(...corners.map(({ position }) => position[2])) - datumZ) / levelHeight
		);
		const roof = (columnRoof(column, datumZ) - datumZ) / levelHeight;
		for (const { id, position } of corners) {
			expect(nodes.get(`vertex/${id}/level/0`)).toEqual(position);
			expect(nodes.get(`vertex/${id}/level/${roof}`)).toEqual([
				position[0],
				position[1],
				columnRoof(column, datumZ)
			]);
		}
		for (let level = first; level < roof; level++) {
			const cell = required(bays.get(`${planCellId}/level/${level}`), 'carrier bay');
			expect(cell.sideFaces).toHaveLength(corners.length);
			for (const [side, faceId] of cell.sideFaces.entries()) {
				const neighbor = bays.get(`${neighbors[side]}/level/${level}`);
				if (neighbor) expect(neighbor.sideFaces).toContain(faceId);
				if (faceId === null) continue;
				const boundary = required(faces.get(faceId), 'carrier face').corners;
				for (const [i, from] of boundary.entries()) {
					const to = boundary[(i + 1) % boundary.length];
					if (from !== to) expect(edges.has(JSON.stringify([from, to].sort()))).toBe(true);
				}
			}
		}
	}
}

const city = createCitySite();
const mountainCity = createCitySite(undefined, { relief: 1, runoff: 1.5 });
for (const plan of cityPlanVariants) {
	const { grid: town, datumZ } = readCityGrid(mountainCity, 1800, plan);
	const columns = readCityColumns(
		town,
		readCityDistricts(mountainCity, town, undefined, { complexity: 1 })
	);

	test(`${plan} tiles a town without holes and keeps connected districts`, () => {
		assertTiled(town);
		expect(assertDistricts(columns)).toContain('block');
	});

	test(`${plan} shares every side up to the lower column in all lattices`, () => {
		for (const frame of cityLatticesByPlan[plan]) {
			const lattice = createCityLattice(columns, datumZ, plan, frame);
			assertCarrier(columns, lattice, datumZ);
		}
	});
}

test('keeps every level and district through asymmetric growth above the center share cap', () => {
	const seed = 2718;
	const start = readCityGrid(city, 6800, 'organic', seed);
	const grown = readCityGrid(city, 7000, 'organic', seed);
	const before = readCityColumns(start.grid, readCityDistricts(city, start.grid, seed));
	const after = readCityColumns(grown.grid, readCityDistricts(city, grown.grid, seed));
	const byId = new Map(after.map((column) => [column.planCellId, column]));
	const rank = { detached: 0, block: 1, center: 2 };
	expect(start.areaKm2).toBeGreaterThan(8);
	expect(after).toHaveLength(grown.grid.cells.length);
	expect(after.length).toBeGreaterThan(before.length);
	const mean = (columns: readonly CityColumn[], axis: 0 | 1) =>
		columns.reduce((sum, { corners }) => sum + corners[0].position[axis], 0) / columns.length;
	const added = after.slice(before.length);
	expect(
		Math.hypot(mean(added, 0) - mean(before, 0), mean(added, 1) - mean(before, 1))
	).toBeGreaterThan(20);
	for (const old of before) {
		const next = required(byId.get(old.planCellId), 'grown column');
		expect(next.corners).toEqual(old.corners);
		expect(rank[next.kind]).toBeGreaterThanOrEqual(rank[old.kind]);
		expect(next.levels).toBeGreaterThanOrEqual(old.levels);
	}
}, 15_000);

test('reads elevated dry ground, explicit water and an empty buildable area from a terrain sampler', () => {
	const [ox, oy] = city.origin;
	const sample = (x: number, y: number) => {
		const distance = Math.abs(x - ox);
		return {
			height: 240 + 0.01 * (y - oy),
			dry: !(distance > 120 && distance < 190),
			waterClearance: Infinity
		};
	};
	const alternate = createCitySite(sample);
	const plan = readCityGrid(alternate, 1800, 'square');
	expect(plan.areaKm2).toBeGreaterThan(1);
	expect(plan.grid.vertices.every(({ position: [x, y, z] }) => z > 180 && sample(x, y).dry)).toBe(
		true
	);
	const constrained = createCitySite(() => ({
		height: 240,
		dry: false,
		waterClearance: 0
	}));
	const empty = readCityGrid(constrained, 1800, 'square');
	expect(empty.grid.cells).toEqual([]);
	expect(empty.areaKm2).toBe(0);
	expect(cityWindow(constrained, empty.grid).width).toBeGreaterThan(0);
});
