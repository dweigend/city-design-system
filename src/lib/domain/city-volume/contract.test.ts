import { expect, test } from 'bun:test';
import { required } from '../../core/invariant';
import { TerrainGrid } from '../terrain-grid';
import {
	cityGrowth,
	cityAccessibility,
	latticeVariants,
	columnRoof,
	createCityDistricts,
	createCityLattice,
	createStructuralColumns,
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

test('classifies 250 cells at the town threshold in rank order', () => {
	const areas = [...Array<number>(249).fill(1 / 249), 999_999];
	const vertices: Array<TerrainGrid['vertices'][number]> = [];
	const cells = areas.map((area, index) => {
		const id = `c${index}`;
		const x = index * 2;
		const corners = [
			[x, 0, 0],
			[x + 1, 0, 0],
			[x + 1, area, 0],
			[x, area, 0]
		] as const;
		const vertexIds = corners.map((position, corner) => {
			const vertexId = `${id}/${corner}`;
			vertices.push({ id: vertexId, position });
			return vertexId;
		});
		return { id, vertexIds, neighbors: corners.map(() => null) };
	});
	const growth = { rankedCellIds: cells.map(({ id }) => id), futureFringe: [] };
	const read = (ordered: typeof cells) => {
		const { areaKm2, settlement } = createCityDistricts(
			{
				cells: ordered,
				vertices,
				identity: { variant: 'square' as const, scope: 'test-plan' },
				boundary: []
			},
			core,
			1201,
			undefined,
			growth
		);
		return { areaKm2, settlement };
	};
	expect(read(cells)).toEqual({ areaKm2: 1, settlement: 'town' });
	expect(read(cells.toReversed())).toEqual(read(cells));
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
			districtId: 'district/square',
			densityRegionId: 'detached/square',
			kind: 'detached',
			levels: 1
		}
	] as const;
	const [box, braced, centered, tetrahedral] = latticeVariants.map((frame) =>
		createCityLattice(columns, 10, frame)
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
	expect(centered.nodes.find(({ id }) => id.endsWith('/center'))?.position).toEqual([7, 7, 9]);
	const sloped = createCityLattice(columns, -4);
	expect(sloped.nodes.find(({ id }) => id === 'vertex/d/level/0')?.position).toEqual([0, 14, 3]);
	expect(sloped.nodes.find(({ id }) => id === 'vertex/d/level/2')?.position).toEqual([0, 14, 10]);
});

test('rejects malformed columns before allocating bays', () => {
	const column: CityColumn = {
		planCellId: 'cell',
		districtId: 'district/cell',
		densityRegionId: 'center/cell',
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
		expect(() => createCityLattice([{ ...column, levels }], 0)).toThrow(RangeError);
	for (let i = 0; i < 3; i++) {
		const position: [number, number, number] = [0, 0, 0];
		position[i] = i === 1 ? NaN : Infinity;
		const corners = [{ id: 'a', position }, ...column.corners.slice(1)];
		expect(() => createCityLattice([{ ...column, corners }], 0)).toThrow(RangeError);
	}
	expect(createCityLattice([{ ...column, levels: 15 }], 0).cells.length).toBe(15);
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

test('enters the second bank through the cheaper crossing after publishing the first head', () => {
	const plan = TerrainGrid.create({
		seed: 1201,
		site: { origin: [0, 0], bearing: 0, length: 840, width: 600 },
		variant: 'square',
		parameters: { cellSize: 60 },
		referenceHeightAt: () => 0,
		heightAt: (x) => (Math.abs(x) < 60 ? undefined : 0)
	});
	const vertices = new Map(plan.vertices.map(({ id, position }) => [id, position]));
	const cells = plan.cells.map(({ id, vertexIds }) => {
		const points = vertexIds.map((key) => required(vertices.get(key), 'bank vertex'));
		const [x, y] = points.reduce(([u, v], [a, b]) => [u + a / 4, v + b / 4], [0, 0]);
		return { id, x, y };
	});
	function head(bank: number, y: number) {
		const best = cells
			.filter(({ x }) => Math.sign(x) === bank)
			.sort(
				(a, b) => Math.hypot(a.x - bank * 90, a.y - y) - Math.hypot(b.x - bank * 90, b.y - y)
			)[0];
		return best.id;
	}
	const north = [head(-1, 150), head(1, 150)] as const;
	const south = [head(-1, -150), head(1, -150)] as const;
	const access = ([x]: readonly [number, number]) => Number(x > 0);
	const right = new Set(cells.filter(({ x }) => x > 0).map(({ id }) => id));
	for (const [short, long] of [
		[north, south],
		[south, north]
	]) {
		const order = cityGrowth(plan, access, 20_000, [
			{ headIds: short, spanM: 120 },
			{ headIds: long, spanM: 190 }
		]).map(({ id }) => id);
		expect(order.find((id) => right.has(id))).toBe(short[1]);
		expect(order.indexOf(short[0])).toBeLessThan(order.indexOf(short[1]));
	}
});

test('a late connector merges districts under the earliest founding plan address', () => {
	const plan = flatPlan(300);
	const [a, bridge, b] = plan.cells;
	const growth = { rankedCellIds: [b.id, a.id, bridge.id], futureFringe: [] };
	const before = createCityDistricts(
		TerrainGrid.select(plan, [a.id, b.id]),
		core,
		0,
		undefined,
		growth
	);
	expect(before.cell(a.id).districtId).toBe(`district/${a.id}`);
	expect(before.cell(b.id).districtId).toBe(`district/${b.id}`);
	const after = createCityDistricts(
		TerrainGrid.select(plan, [a.id, bridge.id, b.id]),
		core,
		0,
		undefined,
		growth
	);
	for (const { id } of [a, bridge, b])
		expect(after.cell(id).districtId).toBe(before.cell(b.id).districtId);
});

test('a proposed bank arm probes the wet strip between its dry midpoint and endpoint', () => {
	let sawStripOnArm = false;
	cityAccessibility(
		0,
		[[0, 0]],
		0,
		(x, y) => {
			const wet = x >= 15 && x <= 25;
			sawStripOnArm ||= wet && Math.abs(y / x - 33.32 / 78.2) < 0.001;
			return { height: 0, waterKind: wet ? 'river' : null };
		},
		() => false
	);
	expect(sawStripOnArm).toBe(true);
});

test('publishes a ten-cell demo with a smaller startup area', () => {
	const plan = TerrainGrid.create({
		seed: 1201,
		variant: 'square',
		parameters: { cellSize: 10 },
		heightAt: () => 0,
		site: {
			origin: [0, 0],
			bearing: 0,
			outline: [
				[0, 0],
				[100, 0],
				[100, 10],
				[0, 10]
			]
		}
	});
	expect(plan.cells).toHaveLength(10);
	const order = cityGrowth(plan, () => 0, 100, [], { startupAreaM2: 100, maxRegions: 1 });
	expect(order.map(({ id }) => id).sort()).toEqual(plan.cells.map(({ id }) => id).sort());
	expect(order[0]).toMatchObject({ builtArea: 100, complete: true });
	expect(order.at(-1)).toMatchObject({ builtArea: 1000, complete: true });
});

const structuralColumn: CityColumn = {
	planCellId: 'column',
	kind: 'block',
	districtId: 'district',
	densityRegionId: 'region',
	levels: 1,
	corners: [
		{ id: 'a', position: [20, 0, 0] },
		{ id: 'b', position: [40, 0, 0] },
		{ id: 'c', position: [20, 20, 0] }
	],
	neighbors: [null, null, null]
};

test('rejects duplicate column cell IDs', () => {
	expect(() => createCityLattice([structuralColumn, structuralColumn], 0)).toThrow(
		new RangeError('Duplicate city column cell ID "column"')
	);
});

test('rejects conflicting positions for a shared corner ID', () => {
	const translated: CityColumn = {
		...structuralColumn,
		planCellId: 'translated',
		corners: structuralColumn.corners.map(({ id, position: [x, y, z] }) => ({
			id,
			position: [x + 100, y, z]
		}))
	};
	expect(() => createCityLattice([structuralColumn, translated], 0)).toThrow(
		new RangeError('Conflicting positions for city corner ID "a"')
	);
});

test('rejects a repeated corner ID within a column ring', () => {
	const [a, b, c] = structuralColumn.corners;
	const repeated = { ...structuralColumn, corners: [a, b, c, a] };
	expect(() => createCityLattice([repeated], 0)).toThrow(
		new RangeError('Duplicate city corner ID "a" in column "column"')
	);
});

test('detaches validated columns and shares equal corner addresses across cells', () => {
	const [a, b, c] = structuralColumn.corners;
	const adjacent = {
		...structuralColumn,
		planCellId: 'adjacent',
		corners: [b, a, { id: 'd', position: [20, -20, 0] as const }]
	};
	const columns = createStructuralColumns([{ ...structuralColumn, corners: [a, b, c] }, adjacent]);
	expect(columns).toEqual([structuralColumn, adjacent]);
	expect(columns[0].corners[0]).toBe(columns[1].corners[1]);
	expect(columns[0].corners[0]).not.toBe(a);
	expect(Object.isFrozen(columns[0].corners[0].position)).toBe(true);
	expect(
		createCityLattice(columns, 0).faces.filter(({ id }) => id.startsWith('side/'))
	).toHaveLength(5);
	expect(() => createStructuralColumns([adjacent, adjacent])).toThrow(RangeError);
});

test('uses an independent level cap and plane spacing for prism and plane models', () => {
	const column = { ...structuralColumn, levels: 16 };
	expect(() => createStructuralColumns([column])).toThrow(RangeError);
	const columns = createStructuralColumns([column], 16);
	const options = { levelHeightM: 4, maxLevels: 16 };
	for (const model of ['box', 'diagrid'] as const) {
		const lattice = createCityLattice(columns, 0, model, options);
		expect(lattice.cells).toHaveLength(16);
		expect(Math.max(...lattice.nodes.map(({ position }) => position[2]))).toBe(64);
		expect(Math.max(...lattice.bayCorners.map(({ position }) => position[2]))).toBe(64);
	}
	expect(columnRoof(column, 0, options.levelHeightM)).toBe(64);
	expect(() => createCityLattice(columns, 0, 'box', { ...options, levelHeightM: 0 })).toThrow(
		RangeError
	);
	expect(() => createCityLattice(columns, 0, 'box', { ...options, maxLevels: 15 })).toThrow(
		RangeError
	);
	expect(() => createStructuralColumns([{ ...structuralColumn, groundAtHub: Number.NaN }])).toThrow(
		RangeError
	);
	const raised = {
		...structuralColumn,
		levels: 1,
		corners: structuralColumn.corners.map(({ id, position: [x, y] }) => ({
			id,
			position: [x, y, 1] as const
		}))
	};
	expect(() => createCityLattice([raised], 1, 'box', { levelHeightM: 1e-20 })).toThrow(RangeError);
});

for (const variant of ['polar', 'free-quad'] as const) {
	test(`builds ${variant} columns from a caller's cell assignment`, () => {
		const plan = TerrainGrid.create({
			seed: 1201,
			site: { origin: [0, 0], bearing: 0, length: 800, width: 600 },
			variant,
			heightAt: () => 0,
			parameters: { cellSize: 60 }
		});
		const ids: string[] = [];
		const columns = readCityColumns(plan, (id) => {
			ids.push(id);
			return { levels: 2, kind: 'block' };
		});
		expect(ids).toEqual(plan.cells.map(({ id }) => id));
		expect(columns.length).toBeGreaterThan(1);
		expect(columns.every(({ levels, kind }) => levels === 2 && kind === 'block')).toBe(true);
		for (const model of latticeVariants)
			expect(createCityLattice(columns, 0, model).cells).toHaveLength(2 * plan.cells.length);
	});
}
