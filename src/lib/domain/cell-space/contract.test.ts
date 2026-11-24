import { describe, expect, test } from 'bun:test';
import type { Vec2 } from '../../core/geometry';
import { levelHeight, storeysPerLevel, subdivideBay, type LatticeBay } from '../city-volume';
import {
	cellAreaM2,
	createCellSpace,
	defaultStoreyHeightM,
	DegenerateParcelError,
	parcelEdgeId,
	storeyAddress,
	type Parcel
} from './index';
import { example } from './example';

const parcel = (id: string, points: readonly Vec2[], frontage = [0]): Parcel => ({
	id,
	corners: points.map((position, i) => ({ id: `c${i}`, position })),
	frontage: frontage.map((i) => parcelEdgeId(`c${i}`, `c${(i + 1) % points.length}`)),
	baseZ: 0,
	storeyCount: 4
});

const hexagon = Array.from({ length: 6 }, (_, i): Vec2 => [
	15 * Math.cos((i * Math.PI) / 3),
	15 * Math.sin((i * Math.PI) / 3)
]);
const fixtures = {
	rectangle: parcel('rectangle', [
		[0, 0],
		[20, 0],
		[20, 30],
		[0, 30]
	]),
	trapezoid: parcel('trapezoid', [
		[0, 0],
		[28, 0],
		[22, 24],
		[3, 26]
	]),
	hexagon: parcel('hexagon', hexagon, [0, 1]),
	triangle: parcel('triangle', [
		[0, 0],
		[34, 0],
		[14, 30]
	]),
	ell: parcel('ell', [
		[0, 0],
		[32, 0],
		[32, 14],
		[14, 14],
		[14, 30],
		[0, 30]
	])
};

function outlineArea(points: readonly Vec2[]) {
	let sum = 0;
	points.forEach(([ax, ay], i) => {
		const [bx, by] = points[(i + 1) % points.length];
		sum += ax * by - bx * ay;
	});
	return sum / 2;
}

function checkTiling(fixture: Parcel, rounds?: number) {
	const space = createCellSpace(fixture, rounds);
	const byId = new Map(space.cells.map((cell) => [cell.id, cell]));
	expect(byId.size).toBe(space.cells.length);
	const area = space.cells.reduce((sum, cell) => sum + cellAreaM2(cell), 0);
	expect(area).toBeCloseTo(outlineArea(fixture.corners.map(({ position }) => position)), 6);
	for (const cell of space.cells)
		for (const { neighbour, edge, frontage } of cell.sides) {
			expect(neighbour).not.toBe(cell.id);
			if (neighbour)
				expect(
					byId.get(neighbour)?.sides.filter((side) => side.neighbour === cell.id)
				).toHaveLength(1);
			else expect(frontage).toBe(fixture.frontage.includes(edge ?? ''));
		}
	return space;
}

describe('createCellSpace', () => {
	test.each(Object.entries(fixtures))(
		'%s: cells tile the parcel and agree on every side',
		(_, fixture) => {
			checkTiling(fixture);
		}
	);

	test('a convex n-gon gives 4n cells per refinement round, a re-entrant L three quads per ear', () => {
		expect(createCellSpace(fixtures.hexagon, 0).cells).toHaveLength(6);
		expect(createCellSpace(fixtures.hexagon).cells).toHaveLength(24);
		expect(createCellSpace(fixtures.ell, 0).cells).toHaveLength(12);
	});

	test('is deterministic and addresses storeys by a fixed grammar', () => {
		expect(createCellSpace(fixtures.ell)).toEqual(createCellSpace(fixtures.ell));
		expect(defaultStoreyHeightM).toBe(levelHeight / storeysPerLevel);
		expect(storeyAddress('p/child/["a"]', 3)).toBe('p/child/["a"]/storey/3');
		expect(() => storeyAddress('p', -1)).toThrow(RangeError);
	});

	test('rejects clockwise, short or mislabelled parcels', () => {
		expect(() =>
			createCellSpace(
				parcel('cw', [
					[0, 0],
					[0, 10],
					[10, 10],
					[10, 0]
				])
			)
		).toThrow(RangeError);
		expect(() =>
			createCellSpace(
				parcel('two', [
					[0, 0],
					[1, 0]
				])
			)
		).toThrow(RangeError);
		expect(() =>
			createCellSpace({
				...parcel('far', [
					[0, 0],
					[1, 0],
					[0, 1]
				]),
				frontage: [parcelEdgeId('c1', 'c0')]
			})
		).toThrow(RangeError);
	});

	test('R11-01: an ear whose diagonal passes through the notch corner is refused', () => {
		const notch: Vec2[] = [
			[0, 0],
			[4, 0],
			[4, 4],
			[2, 2],
			[0, 4]
		];
		for (let shift = 0; shift < notch.length; shift += 1)
			checkTiling(
				parcel(
					`notch${shift}`,
					notch.map((_, i) => notch[(i + shift) % notch.length])
				)
			);
	});

	test('R11-02: sides match by identity; degenerate parcels throw a named error', () => {
		expect(() =>
			createCellSpace(
				parcel('thin', [
					[0, 0],
					[10, 0],
					[10, 1e-7],
					[0, 1e-7]
				])
			)
		).toThrow(DegenerateParcelError);
		expect(() =>
			createCellSpace(
				parcel('spike', [
					[0, 0],
					[8, 0],
					[8, 6],
					[8 - 1e-7, 6],
					[0, 6]
				])
			)
		).toThrow(DegenerateParcelError);
		const space = checkTiling(
			parcel('thin-ok', [
				[0, 0],
				[10, 0],
				[10, 0.02],
				[0, 0.02]
			])
		);
		expect(
			space.cells.filter(({ sides }) => sides.some(({ frontage }) => frontage)).length
		).toBeGreaterThan(0);
	});

	test('R11-03: refinement rounds must be a bounded non-negative integer', () => {
		for (const rounds of [0.1, NaN, Infinity, -1, 4])
			expect(() => createCellSpace(fixtures.rectangle, rounds)).toThrow(RangeError);
		expect(createCellSpace(fixtures.rectangle, 3).cells).toHaveLength(256);
	});

	test('R11-06: ring rotation keeps ids and geometry; escaped parcel ids never collide with ears', () => {
		const { corners } = fixtures.ell;
		const rotated = {
			...fixtures.ell,
			corners: corners.map((_, i) => corners[(i + 2) % corners.length])
		};
		expect(createCellSpace(rotated)).toEqual(createCellSpace(fixtures.ell));
		const ears = createCellSpace(
			parcel(
				'p',
				fixtures.ell.corners.map(({ position }) => position)
			)
		).cells.map(({ id }) => id);
		const look = createCellSpace(
			parcel('p/ear/0', [
				[0, 0],
				[10, 0],
				[0, 10]
			])
		).cells.map(({ id }) => id);
		expect(look.filter((id) => ears.includes(id))).toEqual([]);
	});

	test('R11-11: far-off coordinates keep their orientation', () => {
		const square: Vec2[] = [
			[1e9, 1e9],
			[1e9 + 6, 1e9],
			[1e9 + 6, 1e9 + 6],
			[1e9, 1e9 + 6]
		];
		expect(createCellSpace(parcel('far', square)).cells).toHaveLength(16);
	});

	test('the example builds and corner quads of a bay are the logical child bays of subdivideBay', () => {
		expect(example().cells).toHaveLength(16);
		const bay: LatticeBay = {
			id: 'p/level/2',
			planCellId: 'p',
			level: 2,
			planCorners: ['a', 'b', 'c', 'd'],
			floorFace: '',
			ceilingFace: '',
			sideFaces: []
		};
		const points: Vec2[] = [
			[0, 0],
			[10, 0],
			[10, 10],
			[0, 10]
		];
		const space = createCellSpace(
			{
				...parcel('p', points, []),
				corners: bay.planCorners.map((id, i) => ({ id, position: points[i] }))
			},
			0
		);
		const corners = new Set(space.cells.map(({ corner }) => corner));
		for (const { id } of subdivideBay(bay))
			expect(corners.has((JSON.parse(id.split('/child/')[1]) as [string, number])[0])).toBe(true);
		expect(corners.size).toBe(4);
	});
});
