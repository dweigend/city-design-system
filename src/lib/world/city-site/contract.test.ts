import { expect, test } from 'bun:test';
import { required } from '../../core/invariant';
import { measurePolygon } from '../../core/geometry';
import {
	createCityLattice,
	columnRoof,
	levelHeight,
	prismVariants,
	readCityColumns,
	type CityColumn,
	type CityLattice
} from '../../domain/city-volume';
import { planEdgeGraph, TerrainGrid } from '../../domain/terrain-grid';
import {
	cityLatticesByPlan,
	cityPlanVariants,
	citySiteParams,
	citySiteConfig,
	cityWindow,
	createCitySite,
	createCityVerticalRecipe,
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
		const layout = readCityGrid(city, length, 'square');
		const { grid, areaKm2 } = layout;
		const districts = readCityDistricts(city, layout);
		expect(districts.settlement).toBe(settlement);
		expect(districts.areaKm2).toBeCloseTo(areaKm2, 9);
		const present = new Set(readCityColumns(grid, districts).map(({ kind }) => kind));
		expect([...present].sort()).toEqual([...kinds]);
	}
	const largest = readCityGrid(city, citySiteParams.citySize.max, 'square');
	expect(largest.areaKm2).toBeGreaterThan(9);
	expect(readCityDistricts(city, largest).peakHeight).toBe(105);
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
	return columns.map(({ kind }) => kind);
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
	const layout = readCityGrid(mountainCity, 1800, plan);
	const { grid: town, datumZ } = layout;
	const columns = readCityColumns(
		town,
		readCityDistricts(mountainCity, layout, undefined, { complexity: 1 })
	);

	test(`${plan} tiles a town without holes and keeps connected districts`, () => {
		assertTiled(town);
		expect(assertDistricts(columns)).toContain('block');
	});

	test(`${plan} shares every side up to the lower column in all prism lattices`, () => {
		// Only prism lattices frame every bay side face with members.
		for (const frame of cityLatticesByPlan[plan].filter((v) =>
			prismVariants.some((p) => p === v)
		)) {
			const lattice = createCityLattice(columns, datumZ, frame);
			assertCarrier(columns, lattice, datumZ);
		}
	});
}

test('keeps every level and district through asymmetric growth above the center share cap', () => {
	const seed = 2718;
	const start = readCityGrid(city, 6800, 'organic', seed);
	const grown = readCityGrid(city, 7000, 'organic', seed);
	const before = readCityColumns(start.grid, readCityDistricts(city, start, seed));
	const after = readCityColumns(grown.grid, readCityDistricts(city, grown, seed));
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
		const height = 240 + 0.01 * (y - oy);
		const waterClearance = Math.max(120 - distance, distance - 190);
		return waterClearance < 0
			? { height, waterKind: 'water' as const, waterClearance, waterHeight: height + 1 }
			: { height, waterKind: null, waterClearance };
	};
	const alternate = createCitySite(sample);
	const plan = readCityGrid(alternate, 1800, 'square');
	expect(plan.areaKm2).toBeGreaterThan(1);
	expect(
		plan.grid.vertices.every(
			({ position: [x, y, z] }) => z > 180 && sample(x, y).waterKind === null
		)
	).toBe(true);
	const constrained = createCitySite(() => ({
		height: 240,
		waterKind: 'water' as const,
		waterHeight: 241,
		waterClearance: -1
	}));
	const empty = readCityGrid(constrained, 1800, 'square');
	expect(empty.grid.cells).toEqual([]);
	expect(empty.areaKm2).toBe(0);
	expect(cityWindow(constrained, empty.grid).width).toBeGreaterThan(0);
});

test('keeps an edge-connected grid over the channel on all seven plans', () => {
	const bank = (x: number) => Math.abs(x) - 56;
	const site = createCitySite((x, y) => {
		const height = 10 + y * 0.002;
		const waterClearance = bank(x);
		return waterClearance < 0
			? { height, waterClearance, waterKind: 'river', waterHeight: height + 1 }
			: { height, waterClearance, waterKind: null };
	});
	for (const variant of cityPlanVariants) {
		const layout = readCityGrid(site, 1800, variant);
		const { grid, plan, crossings, datumZ, areaKm2 } = layout;
		const growth = readCityGrid(site, 2400, variant);
		const next = new Set(growth.plan.cells.map(({ id }) => id));
		const built = new Map(grid.cells.map((cell) => [cell.id, cell]));
		const cells = new Map(plan.cells.map((cell) => [cell.id, cell]));
		expect(crossings.length).toBeGreaterThan(0);
		for (const cell of plan.cells) {
			expect(next.has(cell.id)).toBe(true);
			expect(built.has(cell.id)).toBe(cell.groundKind === 'dry');
		}
		expect(crossings).toEqual(readCityGrid(site, 1800, variant).crossings);
		const graph = planEdgeGraph(plan);
		const edges = new Map(graph.edges.map((edge) => [edge.id, edge]));
		const selected = readCityGrid(site, 1800, variant).selectedCrossings;
		expect(selected).toEqual(
			crossings.slice(
				0,
				citySiteConfig.selectionBaseCount +
					Math.ceil(areaKm2 / citySiteConfig.selectionIncrementKm2)
			)
		);
		for (const {
			heads: [a, b],
			path
		} of crossings) {
			expect(a.cellIds.every((id) => built.has(id))).toBe(true);
			expect(b.cellIds.every((id) => built.has(id))).toBe(true);
			expect(a.cellIds.every((id) => built.get(id)?.vertexIds.includes(a.nodeId))).toBe(true);
			expect(b.cellIds.every((id) => built.get(id)?.vertexIds.includes(b.nodeId))).toBe(true);
			expect(path.nodeIds[0]).toBe(a.nodeId);
			expect(path.nodeIds.at(-1)).toBe(b.nodeId);
			expect(Math.sign(graph.point(a.nodeId)[0])).toBe(-Math.sign(graph.point(b.nodeId)[0]));
			expect(path.edges).toHaveLength(path.nodeIds.length - 1);
			let length = 0;
			for (const [i, { id, from, to }] of path.edges.entries()) {
				expect([from, to]).toEqual(path.nodeIds.slice(i, i + 2));
				const edge = required(edges.get(id), 'crossing edge');
				expect([...edge.nodeIds].sort()).toEqual(path.nodeIds.slice(i, i + 2).sort());
				expect(edge.cellIds.some((id) => cells.get(id)?.groundKind === 'river')).toBe(true);
				length += edge.lengthM;
			}
			expect(path.lengthM).toBeCloseTo(length, 9);
			expect(path.lengthM).toBeLessThanOrEqual(citySiteConfig.crossingMaxLengthM);
			expect(
				growth.crossings.some(({ path: grown }) => grown.nodeIds.join() === path.nodeIds.join())
			).toBe(true);
		}
		const districts = readCityDistricts(site, layout);
		expect(() => readCityDistricts(site, { ...layout, grid: plan })).toThrow('buildable grid');
		expect(() => readCityColumns(plan, districts)).toThrow('buildable grid');
		const columns = readCityColumns(grid, districts);
		const lattice = createCityLattice(columns, datumZ);
		expect(columns.every(({ planCellId }) => cells.get(planCellId)?.groundKind === 'dry')).toBe(
			true
		);
		expect(
			lattice.cells.every(({ planCellId }) => cells.get(planCellId)?.groundKind === 'dry')
		).toBe(true);
	}
}, 30_000);

test('clamps the body-centered ground hub to its own sampled terrain contact', () => {
	const bump = (x: number, y: number) =>
		9 * (Math.sin((Math.PI * x) / 60) * Math.sin((Math.PI * y) / 60)) ** 2;
	const site = createCitySite((x, y) => ({
		height: 24 + bump(x, y),
		waterKind: null,
		waterClearance: Infinity
	}));
	const layout = readCityGrid(site, 600, 'square');
	const { grid, datumZ } = layout;
	const columns = readCityColumns(grid, readCityDistricts(site, layout));
	const lattice = createCityLattice(columns, datumZ, 'centered');
	const groundHubs = lattice.nodes.filter(({ id }) => id.endsWith('/ground-center'));
	expect(groundHubs.length).toBeGreaterThan(0);
	for (const {
		position: [x, y, z]
	} of groundHubs) {
		expect(z).toBeCloseTo(site.sampleGround(x, y).height, 9);
	}
});

test('retains the growth rank and fringe when the plan is copied, serialized or reselected', () => {
	const site = createCitySite(undefined, { seed: 1201, relief: 0.35, runoff: 1 });
	const initial = readCityGrid(site, 1800);
	const columns = (layout: typeof initial) =>
		readCityColumns(layout.grid, readCityDistricts(site, layout));
	const copied = structuredClone(initial);
	const stored = JSON.parse(JSON.stringify(initial)) as typeof initial;
	expect(initial.growth.futureFringe.length).toBeGreaterThan(0);
	expect(columns(copied)).toEqual(columns(initial));
	expect(columns(stored)).toEqual(columns(initial));
	expect(
		columns({ ...initial, grid: TerrainGrid.select(initial.grid, initial.growth.rankedCellIds) })
	).toEqual(columns(initial));
});

test('keeps body-centered hubs above sampled ground on the seed 1201 organic town', () => {
	const site = createCitySite(undefined, { seed: 1201, relief: 0.35, runoff: 1 });
	const layout = readCityGrid(site, 1800);
	const columns = readCityColumns(layout.grid, readCityDistricts(site, layout));
	const lattice = createCityLattice(columns, layout.datumZ, 'centered');
	const hubs = lattice.nodes.filter(
		({ id }) => id.endsWith('/center') || id.endsWith('/ground-center')
	);
	const nearby = hubs.filter(({ position: [x, y] }) => Math.hypot(x + 161.108, y + 65.789) < 0.01);
	expect(nearby.length).toBeGreaterThan(0);
	for (const {
		position: [x, y, z]
	} of nearby)
		expect(z).toBeGreaterThanOrEqual(site.sampleGround(x, y).height);
});

test('uses a cell elevation range for buildability on a steady slope', () => {
	const { maximumCellRiseM, coarseCellSizeM } = citySiteConfig;
	const onSlope = (rise: number) =>
		createCitySite((_x, y) => ({
			height: (y * rise) / coarseCellSizeM,
			waterKind: null,
			waterClearance: Infinity
		}));
	const allowed = readCityGrid(onSlope(maximumCellRiseM - 1), 600, 'square');
	const rejected = readCityGrid(onSlope(maximumCellRiseM + 1), 600, 'square');
	expect(allowed.grid.cells.length).toBeGreaterThan(0);
	expect(rejected.grid.cells.length).toBe(0);
});

test('terrain edits and undo refresh the carrier datum through one site', () => {
	let revision = '0';
	let height = 0;
	let samples = 0;
	const site = createCitySite(
		() => {
			samples++;
			return { height, waterClearance: Infinity, waterKind: null };
		},
		{ terrainRevision: () => revision }
	);
	const datum = () => readCityGrid(site, 600, 'square').datumZ;
	expect(datum()).toBe(0);
	const initialSamples = samples;
	expect(datum()).toBe(0);
	expect(samples).toBe(initialSamples);

	height = 35;
	revision = '1';
	expect(datum()).toBe(35);
	expect(samples).toBeGreaterThan(initialSamples);

	height = 0;
	revision = '0';
	expect(datum()).toBe(0);
}, 20_000);

test('uses recipe spacing for the city datum, district heights and coarse lattice', () => {
	const heights = [4.8, 3.2, 3.2, 4.5];
	const site = createCitySite(undefined, { recipe: { storeyHeightsM: heights } });
	const recipe = required(site.recipe, 'city recipe');
	heights[0] = 6;
	expect(recipe.storeysPerLevel).toBe(4);
	expect(recipe.levelHeightM).toBe(15.7);
	expect(recipe.storeyHeightsM).toEqual([4.8, 3.2, 3.2, 4.5]);
	const layout = readCityGrid(site, 600);
	expect(layout.datumZ / recipe.levelHeightM).toBeCloseTo(
		Math.round(layout.datumZ / recipe.levelHeightM)
	);
	const districts = readCityDistricts(site, layout);
	const columns = readCityColumns(layout.grid, districts);
	expect(districts.peakHeight).toBe(
		Math.max(...columns.map(({ levels }) => levels)) * recipe.levelHeightM
	);
	const column = columns[0];
	const frame = createCityLattice([column], layout.datumZ, 'box', recipe);
	expect(Math.max(...frame.nodes.map(({ position }) => position[2]))).toBe(
		columnRoof(column, layout.datumZ, recipe.levelHeightM)
	);
	expect(createCityVerticalRecipe({ levelHeightM: 10, storeysPerLevel: 4 }).storeyHeightM).toBe(
		2.5
	);
	expect(() => createCityVerticalRecipe({ levelHeightM: 12, storeyHeightsM: [4, 5] })).toThrow(
		RangeError
	);
});
