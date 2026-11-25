import { describe, expect, test } from 'bun:test';
import {
	createCellSpace,
	parcelEdgeId,
	readStoreyElevation,
	readStoreyHeight
} from '../../domain/cell-space';
import {
	createHouseCourt,
	createHouseObject,
	houseFaces,
	houseSlots,
	houseStyles,
	type HouseStyle
} from '../../domain/house-court';
import { createClad } from '../../domain/material';
import { paintClad } from '../surface';
import { example } from './example';
import { fullSurfaces } from './surfaces';
import {
	readHouseDetail,
	houseLevels,
	houseMaterials,
	houseUseColors,
	paintHouseUse,
	projectHouse,
	projectProgrammedHouse
} from './index';

const space = createCellSpace({
	id: 'plot',
	corners: [
		{ id: 'a', position: [0, 0] },
		{ id: 'b', position: [20, 0] },
		{ id: 'c', position: [20, 24] },
		{ id: 'd', position: [0, 24] }
	],
	frontage: [parcelEdgeId('a', 'b')],
	baseZ: 0,
	storeyCount: 8
});

test('programmed projection honours storey treatments, style tint and cladding budget', () => {
	const style = {
		...houseStyles.memphis,
		fill: { ...houseStyles.memphis.fill, kinds: ['block'] as const },
		roof: { ...houseStyles.memphis.roof, kinds: ['wedge'] as const }
	};
	const house = createHouseCourt(space, { height: 14, width: 24, complexity: 0, seed: 2 }, style, {
		storeyProgram: (index) =>
			index < 2 ? { phase: 'retained', use: 'public' } : { phase: 'addition', use: 'office' }
	});
	const faces = houseFaces(space, house, 'full', style);
	const model = { space, house, style };
	const points = { level: 'plain' as const, budget: 0, plainTone: 'chocolate' as const };
	const materials = houseMaterials.memphis;
	const plain = projectProgrammedHouse(model, 'block', [], [], materials, 'full', points);
	const addition = plain.drawables.find(({ useColor }) => useColor === houseUseColors.office);
	expect(addition?.color).toBe('--model-chocolate');
	expect(plain.triangles).toBe(0);
	const retained = plain.drawables.find(({ useColor }) => useColor === houseUseColors.public);
	if (!retained) throw new Error('Expected a retained hall');
	const focus = paintHouseUse(retained);
	expect(focus).toMatchObject({
		color: houseUseColors.public,
		preserveColor: true,
		hatch: undefined,
		occlude: undefined
	});
	expect(focus.shape).toBe(retained.shape);
	const budget = 5_000;
	for (const level of ['far', 'mid', 'near'] as const) {
		const drawn = projectProgrammedHouse(model, 'full', [], faces, materials, 'full', {
			level,
			budget
		});
		expect(drawn.triangles).toBeGreaterThan(0);
		expect(drawn.triangles).toBeLessThanOrEqual(budget);
		expect(
			drawn.drawables.some(
				({ id, useColor }) => id.includes('use%3A') && useColor === houseUseColors.office
			)
		).toBe(true);
	}
	const one = createHouseCourt(space, { height: 3.5, width: 24, complexity: 0, seed: 2 }, style, {
		storeyProgram: () => ({ phase: 'retained', use: 'public' })
	});
	const roof = projectProgrammedHouse(
		{ ...model, house: one },
		'full',
		[],
		houseFaces(space, one, 'full', style),
		materials,
		'full',
		{ level: 'near', budget }
	).drawables.find(({ id }) => id.endsWith('/roof'));
	expect(roof?.color).toBe(retained.color);
	expect(roof?.useColor).toBe(houseUseColors.public);
});

describe('projectHouse', () => {
	test('every slot any style declares has a full surface', () => {
		for (const style of Object.values(houseStyles) as HouseStyle[])
			for (const slot of houseSlots(style, 'full'))
				expect(Object.hasOwn(fullSurfaces, slot)).toBe(true);
	});

	test('draws every style at every display level, hidden as nothing', () => {
		for (const style of Object.values(houseStyles) as HouseStyle[]) {
			const house = createHouseCourt(
				space,
				{ height: 14, width: 24, complexity: 1, seed: 2 },
				style
			);
			for (const level of Object.keys(houseLevels) as (keyof typeof houseLevels)[]) {
				const drawables = projectHouse(
					createHouseObject(space, house, readHouseDetail(level), style),
					level
				);
				if (level === 'hidden') expect(drawables).toEqual([]);
				else expect(drawables.length).toBeGreaterThan(0);
			}
		}
	});

	test('the example draws a pencil house', () => {
		expect(example().every(({ hatch }) => hatch !== undefined)).toBe(true);
	});
});

test('paints an explicit wall patch alongside a house made with the wall role', () => {
	const house = createHouseCourt(space, { height: 14, width: 24, complexity: 0, seed: 2 });
	const object = createHouseObject(space, house, 'full');
	const cell = space.cells.find(
		({ id, sides }) =>
			sides.some(({ frontage }) => frontage) &&
			house.cells.some((run) => run.id === id && run.fromStorey === 0 && run.toStorey > 0)
	);
	if (!cell) throw new Error('Missing built frontage');
	const side = cell.sides.findIndex(({ frontage }) => frontage);
	const [x, y] = cell.quad[side];
	const [u, v] = cell.quad[(side + 1) % cell.quad.length];
	const width = Math.hypot(u - x, v - y);
	const dx = (u - x) / width;
	const dy = (v - y) / width;
	const patch = {
		origin: [x, y, space.baseZ] as const,
		across: [dx, dy, 0] as const,
		normal: [dy, -dx, 0] as const,
		size: [width, readStoreyHeight(space, 0)] as const,
		thickness: 0.05
	};
	const corners = [space.baseZ, readStoreyElevation(space, 1)].flatMap((z) => [
		[x, y, z],
		[u, v, z]
	]);
	const wall = object.parts.find(
		({ slot, shape }) =>
			slot === 'wall' &&
			shape.kind === 'mesh' &&
			corners.every(([a, b, c]) =>
				shape.positions.some(
					(value, i) =>
						i % 3 === 0 &&
						value === a &&
						shape.positions[i + 1] === b &&
						shape.positions[i + 2] === c
				)
			)
	);
	if (!wall) throw new Error('Missing the house wall carrying the patch');
	const clad = createClad(object, [{ role: wall.slot, family: 'stripe', patch }]);
	const declared = Object.fromEntries(
		object.slots.map((slot) => [slot, fullSurfaces[slot as keyof typeof fullSurfaces]])
	);
	const drawing = paintClad(clad, 'normal', declared);
	expect(clad.object.anchors).toEqual(object.anchors);
	expect(drawing.find(({ id }) => id === wall.id)?.color).toBe('--model-cream');
	expect(drawing.find(({ id }) => id === 'wall/face')?.color).toBe('--model-white');
	expect(drawing.find(({ id }) => id === 'wall/mark')?.color).toBe('--model-ink');
});

test('programmed plain LOD suppresses surface grain even without a tone override', () => {
	const house = createHouseCourt(
		space,
		{ height: 14, width: 24, complexity: 0, seed: 2 },
		houseStyles.organic,
		{
			storeyProgram: (index) =>
				index < 2 ? { phase: 'retained', use: 'public' } : { phase: 'addition', use: 'housing' }
		}
	);
	const plain = projectProgrammedHouse(
		{ space, house, style: houseStyles.organic },
		'full',
		[],
		[],
		houseMaterials.organic,
		'full',
		{ level: 'plain', budget: 0 }
	);
	expect(plain.drawables.some(({ useColor }) => useColor === houseUseColors.housing)).toBe(true);
	expect(plain.drawables.every(({ grain }) => !grain)).toBe(true);
});
