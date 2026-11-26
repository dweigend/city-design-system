import { expect, test } from 'bun:test';
import type { Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import {
	createCellSpace,
	createStripSpace,
	parcelEdgeId,
	readStoreyElevation,
	seamEdgeId,
	type CellSpace
} from '../cell-space';
import { example, occupancyParameters, operatorsExample } from './example';
import {
	createHouseOccupancy,
	createMassing,
	createMassingParts,
	createPorousMassing,
	createSetbackMassing,
	type Massing
} from './index';

test('a sampled rise opens the entrance and keeps program only on the occupied datum', () => {
	const house = example();
	const id = 'lane-plot/strip/[0,0]';
	expect(house.entrances).toEqual([[id]]);
	expect(house.site).toEqual({ entranceRiseM: 1.5, laneZ: 8.5, corner: false, groundZ: null });
	expect(house.cells).toEqual([
		{
			id,
			role: 'gate',
			fromStorey: 1,
			toStorey: 2,
			program: [
				{
					phase: 'addition',
					use: 'office',
					key: '["lane-plot","lane-plot/strip/[0,0]","d",6]',
					cellId: id,
					storey: 1,
					datumIndex: 6
				}
			]
		}
	]);
});

const rectangle = [
	[0, 0],
	[24, 0],
	[24, 24],
	[0, 24]
] as const;
const irregular = [
	[0, 0],
	[26, 0],
	[20, 14],
	[12, 14],
	[12, 27],
	[0, 22]
] as const;

function fixture(points: readonly Vec2[] = rectangle, frontage = [0]) {
	const corners = points.map((position, index) => ({ id: String(index), position }));
	const space = createCellSpace({
		id: 'operator-test',
		corners,
		frontage: frontage.map((index) => parcelEdgeId(corners[index].id, corners[index + 1].id)),
		baseZ: 4,
		datumIndex: -2,
		storeyCount: 6,
		storeyHeightsM: [4, 3, 3, 4, 3, 4]
	});
	const house = createHouseOccupancy(
		space,
		{ height: 21, width: 32, seed: 7 },
		occupancyParameters,
		{ storeyProgram: () => ({ phase: 'retained', use: 'office' }) }
	);
	return { space, house, baseline: createMassing(house) };
}

const countAt = (massing: Massing, storey: number) =>
	massing.runs.filter(({ fromStorey, toStorey }) => fromStorey <= storey && storey < toStorey)
		.length;
const programs = (massing: Massing) => massing.runs.flatMap(({ program }) => program ?? []);

function expectSupported(space: CellSpace, massing: Massing) {
	const foot = new Map(massing.base.cells.map(({ id, fromStorey }) => [id, fromStorey]));
	const anchored = massing.runs.filter(({ id, fromStorey }) => fromStorey === foot.get(id));
	for (const run of massing.runs) {
		if (run.fromStorey === foot.get(run.id)) continue;
		const cell = space.cells.find(({ id }) => id === run.id);
		for (let storey = run.fromStorey; storey < run.toStorey; storey++)
			expect(
				anchored.some(
					({ id, fromStorey, toStorey }) =>
						fromStorey <= storey &&
						storey < toStorey &&
						cell?.sides.some(({ neighbour }) => neighbour === id)
				)
			).toBe(true);
	}
}

test('setback cuts successive frontage bands and retains the original lower storeys and datum keys', () => {
	const { space, house, baseline } = fixture();
	const options = { startStorey: 2, depth: 1, stepStoreys: 1 };
	const setback = createSetbackMassing(space, baseline, options);
	expect(setback.base).toBe(house);
	for (let storey = 0; storey < space.storeyCount; storey++) {
		if (storey < options.startStorey)
			expect(countAt(setback, storey)).toBe(countAt(baseline, storey));
		else {
			expect(countAt(setback, storey)).toBeLessThan(countAt(baseline, storey));
			expect(countAt(setback, storey)).toBeLessThanOrEqual(countAt(setback, storey - 1));
		}
	}
	const frontage = space.cells.filter(({ sides }) => sides.some((side) => side.frontage));
	for (const cell of frontage)
		expect(setback.runs.find(({ id }) => id === cell.id)?.toStorey).toBe(options.startStorey);
	expect(programs(setback).every((program) => programs(baseline).includes(program))).toBe(true);
	expectSupported(space, setback);
	expect(createSetbackMassing(space, baseline, { ...options, depth: 0 })).toBe(baseline);
	expect(
		createSetbackMassing(space, baseline, { ...options, startStorey: space.storeyCount })
	).toBe(baseline);
});

test('a strip seam without a neighbour does not seed the perimeter setback', () => {
	const { space, baseline } = fixture();
	const seamCell = required(
		space.cells.find(
			({ sides }) =>
				sides.some(({ frontage }) => frontage) &&
				sides.filter(({ neighbour }) => neighbour === null).length === 1
		),
		'cell with one boundary side'
	);
	const splitSpace = {
		...space,
		kind: 'strip',
		cells: space.cells.map((cell) =>
			cell === seamCell
				? {
						...cell,
						sides: cell.sides.map((side) =>
							side.frontage
								? { ...side, edge: seamEdgeId('inner-a', 'inner-b'), frontage: false }
								: side
						)
					}
				: cell
		)
	} as const;
	const options = { startStorey: 2, depth: 1, edge: 'perimeter' } as const;
	const outer = createSetbackMassing(space, baseline, options);
	const seam = createSetbackMassing(splitSpace, baseline, options);
	expect(outer.runs.find(({ id }) => id === seamCell.id)?.toStorey).toBe(2);
	expect(seam.runs.find(({ id }) => id === seamCell.id)?.toStorey).toBeGreaterThan(2);
});

test('porosity advances a keyed carving sequence and leaves every ground and access cell in place', () => {
	const { space, house, baseline } = fixture();
	const low = createPorousMassing(space, baseline, { ratio: 0.15 });
	const high = createPorousMassing(space, baseline, { ratio: 0.35 });
	const candidates = programs(baseline).length - baseline.runs.length;
	expect(low.voids).toHaveLength(Math.round(0.15 * candidates));
	expect(high.voids).toHaveLength(Math.round(0.35 * candidates));
	expect(high.voids.slice(0, low.voids.length)).toEqual([...low.voids]);
	expect(createPorousMassing(space, baseline, { ratio: 0.35, seed: 7 })).toEqual(high);
	expect(createPorousMassing(space, baseline, { ratio: 0.35, seed: 8 }).voids).not.toEqual(
		high.voids
	);
	expect(createPorousMassing(space, baseline, { ratio: 0 }).massing).toBe(baseline);
	expect(createPorousMassing(space, baseline, { ratio: 0 }).voids).toEqual([]);
	expect(high.massing.base).toBe(house);
	expect(house.entrances.some((path) => path.length > 0)).toBe(true);
	expect(house.cells.some(({ role }) => role === 'court')).toBe(true);
	expect(countAt(high.massing, 0)).toBe(countAt(baseline, 0));
	for (const run of baseline.runs)
		expect(
			high.massing.runs.some(({ id, fromStorey }) => id === run.id && fromStorey === run.fromStorey)
		).toBe(true);
	expectSupported(space, high.massing);
	expect(high.voids.some(({ kind }) => kind === 'pass-through')).toBe(true);
	const retained = new Set(programs(high.massing).map(({ key }) => key));
	expect(high.voids.every(({ key }) => !retained.has(key))).toBe(true);
	const original = new Set(programs(baseline).map(({ key }) => key));
	expect(high.voids.every(({ key }) => original.has(key))).toBe(true);
	const all = createPorousMassing(space, baseline, { ratio: 1 });
	expect(all.voids).toHaveLength(candidates);
});

for (const [name, points, frontage] of [
	['orthogonal', rectangle, [0]],
	['corner', rectangle, [0, 1]],
	['irregular', irregular, [0]]
] as const) {
	test(`composed operators on the ${name} parcel preserve closed, slot-named datum parts`, () => {
		const { space, baseline } = fixture(points, [...frontage]);
		const setback = createSetbackMassing(space, baseline, {
			startStorey: 3,
			depth: 1,
			edge: 'perimeter'
		});
		const { massing, voids } = createPorousMassing(space, setback, { ratio: 0.25 });
		expect(voids.length).toBeGreaterThan(0);
		expect(programs(setback).length).toBeLessThan(programs(baseline).length);
		expectSupported(space, massing);
		const baselineParts = new Map(
			createMassingParts(space, baseline).map((part) => [part.id, part])
		);
		const parts = createMassingParts(space, massing);
		expect(parts).toHaveLength(programs(massing).length);
		expect(new Set(parts.map(({ id }) => id)).size).toBe(parts.length);
		for (const [index, { cellId, storey, datumIndex }] of programs(massing).entries()) {
			const part = parts[index];
			expect(baselineParts.get(part.id)).toEqual(part);
			const cell = required(
				space.cells.find(({ id }) => id === cellId),
				'part cell'
			);
			expect(part).toEqual({
				id: `${cellId}/envelope/datum/${datumIndex}`,
				slot: 'mass',
				shape: {
					kind: 'prism',
					polygon: cell.quad,
					base: readStoreyElevation(space, storey),
					top: readStoreyElevation(space, storey + 1)
				}
			});
		}
	});
}

test('setback can follow porosity without filling a gap or leaving a suspended slice behind', () => {
	const { space, baseline } = fixture();
	const porous = createPorousMassing(space, baseline, { ratio: 0.35 }).massing;
	expect(porous.runs.length).toBeGreaterThan(baseline.runs.length);
	const result = createSetbackMassing(space, porous, { startStorey: 2, depth: 2, stepStoreys: 2 });
	const porousKeys = new Set(programs(porous).map(({ key }) => key));
	expect(programs(result).every(({ key }) => porousKeys.has(key))).toBe(true);
	expect(programs(result).length).toBeLessThan(porousKeys.size);
	expect(countAt(result, 1)).toBe(countAt(porous, 1));
	expectSupported(space, result);
});

test('the fixed operators example yields fewer closed parts after each cut', () => {
	const { baseline, setback, parts, voids } = operatorsExample();
	const sliceCount = (massing: Massing) =>
		massing.runs.reduce((count, { fromStorey, toStorey }) => count + toStorey - fromStorey, 0);
	expect(sliceCount(setback)).toBeLessThan(sliceCount(baseline));
	expect(voids.length).toBeGreaterThan(0);
	expect(parts.length + voids.length).toBe(sliceCount(setback));
});

test('invalid operator inputs and mismatched spaces fail before carving', () => {
	const { space, baseline } = fixture();
	expect(() => createSetbackMassing(space, baseline, { startStorey: 0, depth: 1 })).toThrow(
		RangeError
	);
	expect(() => createSetbackMassing(space, baseline, { startStorey: 1, depth: 0.5 })).toThrow(
		RangeError
	);
	expect(() => createPorousMassing(space, baseline, { ratio: 1.1 })).toThrow(RangeError);
	expect(() => createPorousMassing(space, baseline, { ratio: 0.5, seed: -1 })).toThrow(RangeError);
	expect(() => createPorousMassing(fixture(irregular).space, baseline, { ratio: 0.5 })).toThrow(
		RangeError
	);
	const shifted = { ...space, datumIndex: space.datumIndex + 15 };
	expect(() => createMassingParts(shifted, baseline)).toThrow(RangeError);
	expect(() => createSetbackMassing(shifted, baseline, { startStorey: 1, depth: 1 })).toThrow(
		RangeError
	);
});

test('setback preserves the occupied entrance slice on a raised single-cell house', () => {
	const space = createStripSpace({
		id: 'lane-plot',
		corners: [
			{ id: 'a', position: [0, 0] },
			{ id: 'b', position: [7, 0] },
			{ id: 'c', position: [7, 7] },
			{ id: 'd', position: [0, 7] }
		],
		frontage: [parcelEdgeId('a', 'b')],
		baseZ: 10,
		storeyCount: 2,
		storeyHeightsM: [4, 3],
		datumIndex: 5
	});
	const raised = example();
	const baseline = createMassing(raised);
	const stepped = createSetbackMassing(space, baseline, { startStorey: 1, depth: 1 });
	const entranceCell = raised.entrances[0]?.[0];
	expect(entranceCell).toBeDefined();
	const run = stepped.runs.find(({ id }) => id === entranceCell);
	expect(run).toBeDefined();
	expect(run?.fromStorey).toBe(1);
	expect(run?.toStorey).toBe(2);
});
