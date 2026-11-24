import { expect, test } from 'bun:test';
import {
	latticeVariants,
	createCityLattice,
	latticeVolumes,
	type CityColumn
} from '../../domain/city-volume';
import { gravityBalanceTolerance, runGravity } from '../../domain/structure';
import { cityStructureSettings, createCityStructure, structureTownExample } from './index';

const { columns, layout, quarter } = structureTownExample();
const { datumZ } = layout;

test('uses a connected quarter of the default town', () => {
	expect(quarter.length).toBe(Math.ceil(columns.length / 4));
	expect(quarter.some(({ kind }) => kind === 'block')).toBe(true);
});

for (const model of latticeVariants) {
	test(`${model} preserves lattice IDs and carries the quarter load to the ground`, () => {
		const lattice = createCityLattice(quarter, datumZ, model);
		const { graph, loads } = createCityStructure(lattice, datumZ);
		expect(graph.joints.map(({ id }) => id)).toEqual(lattice.nodes.map(({ id }) => id).sort());
		expect(graph.members.map(({ id }) => id)).toEqual(lattice.edges.map(({ id }) => id).sort());

		const ground = lattice.nodes.filter(({ id }) => /\/level\/0$|\/ground-center$/.test(id));
		expect(ground.length).toBeGreaterThan(0);
		expect(graph.joints.filter(({ support }) => support === 'pinned').map(({ id }) => id)).toEqual(
			ground.map(({ id }) => id).sort()
		);
		expect(graph.members.some(({ section }) => section === 'heavy')).toBe(true);
		expect(graph.members.some(({ section }) => section === 'light')).toBe(true);
		expect(graph.members.some(({ role }) => role === 'beam')).toBe(true);

		const result = runGravity(graph, loads);
		const volume = latticeVolumes(lattice).reduce((sum, value) => sum + value, 0);
		const weight = volume * cityStructureSettings.tributaryWeightKNM3.value;
		expect(Math.abs(result.appliedKN - weight)).toBeLessThan(weight * gravityBalanceTolerance);
		expect(result.status).toBe('routed');
		expect(result.unsupported).toEqual([]);
		expect(Math.abs(result.appliedKN - result.reactedKN)).toBeLessThan(
			result.appliedKN * gravityBalanceTolerance
		);
	});
}

function flatCell(x = 0): CityColumn {
	const size = 60;
	return {
		planCellId: `cell/${x}`,
		corners: [
			[x, 0],
			[x + size, 0],
			[x + size, size],
			[x, size]
		].map(([u, v]) => ({
			id: `${u}/${v}`,
			position: [u, v, 0]
		})),
		neighbors: [null, null, null, null],
		districtId: 'district/fixture',
		densityRegionId: 'block/fixture',
		kind: 'block',
		levels: 3
	};
}

test('keeps all twelve flat facade diagonals primary and shared-wall diagonals light', () => {
	const build = (columns: readonly CityColumn[]) =>
		createCityStructure(createCityLattice(columns, 0, 'braced'), 0).graph;
	const isolated = build([flatCell()]);
	const braces = isolated.members.filter(({ role }) => role === 'brace');
	expect(braces).toHaveLength(12);
	expect(braces.every(({ section }) => section === 'heavy')).toBe(true);

	const joined = build([flatCell(), flatCell(60)]);
	const wall = new Set(
		joined.joints.filter(({ position }) => position[0] === 60).map(({ id }) => id)
	);
	const interior = joined.members.filter(
		({ role, from, to }) => role === 'brace' && wall.has(from) && wall.has(to)
	);
	expect(interior).toHaveLength(3);
	expect(interior.every(({ section }) => section === 'light')).toBe(true);
});

test('keeps facade braces primary on a real shoreline-clipped cell', () => {
	const shore = new Set(layout.grid.vertices.filter(({ shore }) => shore).map(({ id }) => id));
	const column = columns.find(({ corners }) => corners.some(({ id }) => shore.has(id)));
	expect(column).toBeDefined();
	if (!column) return;
	const { graph } = createCityStructure(createCityLattice([column], datumZ, 'braced'), datumZ);
	const braces = graph.members.filter(({ role }) => role === 'brace');
	expect(braces.length).toBeGreaterThan(0);
	expect(braces.every(({ section }) => section === 'heavy')).toBe(true);
});

for (const model of ['braced', 'centered'] as const) {
	test(`${model} town utilization spreads across the reference range at nominal load`, () => {
		const { graph, loads } = createCityStructure(createCityLattice(columns, datumZ, model), datumZ);
		const estimates = runGravity(graph, loads).members.flatMap(({ utilization }) =>
			utilization === null ? [] : [utilization]
		);
		expect(estimates.length).toBeGreaterThan(1000);
		expect(estimates.filter((ratio) => ratio > 1).length / estimates.length).toBeLessThan(0.4);
		for (const [start, end] of [
			[0, 0.25],
			[0.25, 0.5],
			[0.5, 0.75],
			[0.75, 1]
		]) {
			expect(
				estimates.filter((ratio) => ratio >= start && ratio < end).length / estimates.length
			).toBeGreaterThan(0.02);
		}
	});
}

test('puts primary shell chords on the lattice recipe rings', () => {
	const levelHeightM = 15.7;
	const interval = cityStructureSettings.ringIntervalLevels.value;
	const column = { ...flatCell(), levels: interval + 1 };
	const lattice = createCityLattice([column], 0, 'box', { levelHeightM });
	const { graph } = createCityStructure(lattice, 0, levelHeightM);
	const perimeter = new Set(
		graph.joints
			.filter(({ position }) => position[2] === interval * levelHeightM)
			.map(({ id }) => id)
	);
	const ring = graph.members.filter(({ from, to }) => perimeter.has(from) && perimeter.has(to));
	expect(ring).toHaveLength(4);
	expect(ring.every(({ section }) => section === 'heavy')).toBe(true);
});
