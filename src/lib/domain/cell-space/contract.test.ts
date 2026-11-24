import { createCatalog } from '../../core/catalog';
import { equalRefs, readWorldReference } from '../../core/ref';
import { describe, expect, test } from 'bun:test';
import type { Vec2 } from '../../core/geometry';
import {
	cellAreaM2,
	cellSubgridCatalog,
	createCellSpace,
	createCellSpaceStoreys,
	createSubgridSpace,
	readCellStoreys,
	readStoreyElevation,
	readStoreyHeight,
	readStoreyRef,
	type CellSubgridGenerator,
	createStripSpace,
	DegenerateParcelError,
	parcelEdgeId,
	storeyAddress,
	type Parcel
} from './index';
import { example, mixedStoreyParcel } from './example';

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

test.each([[['a,b', 'c,a', 'b,c', 'd']], [['a,b', 'c,a', 'b,c', 'c(p)']]])(
	'tiles a 12 by 8 m parcel with delimiter-bearing corners %j',
	(ids) => {
		const fixture = parcel('p', [
			[0, 0],
			[12, 0],
			[12, 8],
			[0, 8]
		]);
		const corners = fixture.corners.map((corner, i) => ({ ...corner, id: ids[i] }));
		const input = { ...fixture, corners, frontage: [parcelEdgeId(ids[0], ids[1])] };
		expect(
			checkTiling(input, 0)
				.cells.map(({ corner }) => corner)
				.sort()
		).toEqual(ids.toSorted());
		expect(checkTiling(input, 1).cells).toHaveLength(16);
	}
);

test('keeps both frontage strips when a corner resembles a generated grid point', () => {
	const fixture = parcel('p', [
		[0, 0],
		[12, 0],
		[12, 8],
		[0, 8]
	]);
	const ids = ['p(1,0)', 'right/a', 'right|b', 'left\n'];
	const corners = fixture.corners.map((corner, i) => ({ ...corner, id: ids[i] }));
	const { cells } = createStripSpace({
		...fixture,
		corners,
		frontage: [parcelEdgeId(ids[0], ids[1])]
	});
	expect(cells.map(({ id }) => id)).toEqual(['p/strip/[0,0]', 'p/strip/[1,0]']);
	expect(cells.map(cellAreaM2)).toEqual([48, 48]);
});

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

	test('delimiter-bearing corner keys keep opposite edge midpoints distinct', () => {
		const ids = ['a', 'b|c', 'a|b', 'c'];
		const corners = fixtures.rectangle.corners.map((corner, i) => ({ ...corner, id: ids[i] }));
		const frontage = [parcelEdgeId(ids[0], ids[1])];
		expect(checkTiling({ ...fixtures.rectangle, corners, frontage }).cells).toHaveLength(16);
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

	test('the example builds a refined rectangular cell space', () => {
		expect(example().cells).toHaveLength(16);
	});
});

test('both cell constructors reject a non-finite base elevation', () => {
	for (const create of [createCellSpace, createStripSpace])
		expect(() => create({ ...fixtures.rectangle, baseZ: NaN })).toThrow('baseZ');
});

test('rejects a sparse plan coordinate before subdivision', () => {
	// Runtime input can violate its declared tuple type.
	const position = new Array<number>(2) as unknown as Vec2;
	const [first, ...rest] = fixtures.rectangle.corners;
	expect(() =>
		createCellSpace({ ...fixtures.rectangle, corners: [{ ...first, position }, ...rest] })
	).toThrow('finite plan positions');
});

test('addresses every slice at the cumulative boundaries and keeps IDs across vertical growth', () => {
	const space = createSubgridSpace(mixedStoreyParcel, 'corner-quad');
	expect(space.storeyHeightM).toBeUndefined();
	expect(space.storeyElevationsM).toEqual([0, 4.8, 8, 11.2, 15.7]);
	expect(space.storeys).toHaveLength(space.cells.length * 4);
	expect(new Set(space.storeys.map(({ ref }) => ref.key)).size).toBe(space.storeys.length);
	const taller = createCellSpaceStoreys(space, {
		baseZ: 9,
		storeyCount: 5,
		storeyHeightsM: [...mixedStoreyParcel.storeyHeightsM, 5]
	});
	const grownKeys = new Set(taller.storeys.map(({ ref }) => ref.key));
	for (const { ref, cellId, storey, bottomZ, topZ, heightM } of readCellStoreys(space, 'fixture')) {
		const restored = readWorldReference(JSON.parse(JSON.stringify(ref)));
		expect(restored && equalRefs(ref, restored)).toBe(true);
		expect(ref).toEqual(readStoreyRef(space.id, cellId, storey, 'fixture'));
		expect(grownKeys.has(ref.key)).toBe(true);
		expect(bottomZ).toBe(readStoreyElevation(space, storey));
		expect(topZ).toBe(readStoreyElevation(space, storey + 1));
		expect(heightM).toBe(readStoreyHeight(space, storey));
	}
	expect(() => readStoreyHeight(space, space.storeyCount)).toThrow(RangeError);
	expect(() => readStoreyElevation(space, -1)).toThrow(RangeError);
});

test('resolves registered subgrids on one parcel and snapshots its vertical inputs', () => {
	const catalog = createCatalog<CellSubgridGenerator>({
		rows: [
			...cellSubgridCatalog.rows,
			{
				id: 'coarse-quad',
				create: (parcel, options) => createCellSpace(parcel, options.refinementRounds ?? 0)
			}
		]
	});
	const heights: number[] = [...mixedStoreyParcel.storeyHeightsM];
	const parcel = { ...mixedStoreyParcel, storeyHeightsM: heights };
	const spaces = catalog.ids.map((id) => createSubgridSpace(parcel, id, {}, catalog));
	heights[0] = 9;
	expect(spaces[2].cells).toHaveLength(4);
	expect(spaces[2].cells.length).toBeLessThan(spaces[0].cells.length);
	expect(spaces[1].kind).toBe('strip');
	for (const space of spaces) {
		expect(space.storeyHeightsM).toEqual(mixedStoreyParcel.storeyHeightsM);
		expect(space.cells.reduce((sum, cell) => sum + cellAreaM2(cell), 0)).toBeCloseTo(28 * 32);
	}
	expect(() => createSubgridSpace(parcel, 'unknown', {}, catalog)).toThrow(RangeError);
});

test('rejects invalid storey arrays and keeps the uniform shorthand', () => {
	for (const heights of [
		[],
		[1],
		[4, 0, 4, 4],
		[4, -1, 4, 4],
		[4, NaN, 4, 4],
		[4, Infinity, 4, 4],
		Array<number>(4)
	]) {
		for (const id of cellSubgridCatalog.ids)
			expect(() =>
				createSubgridSpace({ ...mixedStoreyParcel, storeyHeightsM: heights }, id)
			).toThrow(RangeError);
	}
	const uniform = createCellSpace({
		...mixedStoreyParcel,
		storeyHeightsM: undefined,
		storeyHeightM: 2.5
	});
	expect(uniform.storeyHeightM).toBe(2.5);
	expect(uniform.storeyHeightsM).toEqual([2.5, 2.5, 2.5, 2.5]);
	expect(uniform.storeyElevationsM).toEqual([0, 2.5, 5, 7.5, 10]);
});
