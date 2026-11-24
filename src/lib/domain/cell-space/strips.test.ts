import { expect, test } from 'bun:test';
import { isConvexCounterclockwise, type Vec2 } from '../../core/geometry';
import {
	cellAreaM2,
	createStripSpace,
	fineCellWidth,
	minimumStripWidthM,
	parcelEdgeId,
	type Parcel
} from './index';

const parcel = (points: readonly Vec2[], court: number[] = []): Parcel => ({
	id: 'town/plot',
	corners: points.map((position, i) => ({ id: `c${i}`, position })),
	frontage: [parcelEdgeId('c0', 'c1')],
	courtEdges: court.map((i) => parcelEdgeId(`c${i}`, `c${(i + 1) % points.length}`)),
	baseZ: 0,
	storeyCount: 2
});

const notchedRing: Vec2[] = [
	[0, 0],
	[20, 0],
	[20, 12],
	[12, 12],
	[12, 6],
	[8, 8],
	[0, 12]
];

const shoelace = (ring: readonly Vec2[]) =>
	ring.reduce((sum, [x, y], i) => {
		const [u, v] = ring[(i + 1) % ring.length];
		return sum + (x * v - u * y) / 2;
	}, 0);

const area = (space: ReturnType<typeof createStripSpace>) =>
	space.cells.reduce((sum, cell) => sum + cellAreaM2(cell), 0);

test('a 9 × 12 m plot is a front and a rear cell; a 20 × 15 m plot three columns of two rows', () => {
	const small = createStripSpace(
		parcel([
			[0, 0],
			[9, 0],
			[9, 12],
			[0, 12]
		])
	);
	expect(small.cells.map(({ id }) => id)).toEqual([
		'town%2Fplot/strip/[0,0]',
		'town%2Fplot/strip/[0,1]'
	]);
	const wide = createStripSpace(
		parcel([
			[0, 0],
			[20, 0],
			[20, 15],
			[0, 15]
		])
	);
	expect(wide.cells).toHaveLength(6);
	expect(wide.cells.filter(({ sides }) => sides.some(({ frontage }) => frontage))).toHaveLength(3);
	expect(area(wide)).toBeCloseTo(300, 9);
});

test('a wedge keeps every cell at least the minimum width', () => {
	const wedge = createStripSpace(
		parcel([
			[0, 0],
			[24, 0],
			[14, 20],
			[10, 20]
		])
	);
	expect(area(wedge)).toBeCloseTo(280, 9);
	for (const cell of wedge.cells)
		expect(fineCellWidth(cell)).toBeGreaterThanOrEqual(minimumStripWidthM);
});

test('the rear edge onto a shared court is marked on the rear cells', () => {
	const space = createStripSpace(
		parcel(
			[
				[0, 0],
				[18, 0],
				[18, 12],
				[0, 12]
			],
			[2]
		)
	);
	const court = space.cells.filter(({ sides }) => sides.some(({ court }) => court));
	expect(court.map(({ id }) => id)).toEqual(
		space.cells.filter(({ id }) => id.endsWith(',1]')).map(({ id }) => id)
	);
});

test('a notched parcel is split into convex parts with seams, covering its area', () => {
	const notched = createStripSpace(
		parcel([
			[0, 0],
			[20, 0],
			[20, 12],
			[12, 12],
			[12, 6],
			[8, 8],
			[0, 12]
		])
	);
	expect(area(notched)).toBeCloseTo(shoelace(notchedRing), 9);
	expect(notched.cells.length).toBeGreaterThan(1);
});

test('a shallow rear notch splits into convex cells suitable for cladding', () => {
	const ring: Vec2[] = [
		[0, 0],
		[6, 0],
		[6, 16],
		[3, 15.96],
		[0, 16]
	];
	const space = createStripSpace(parcel(ring));
	expect(area(space)).toBeCloseTo(shoelace(ring), 9);
	for (const { quad } of space.cells) expect(isConvexCounterclockwise(quad)).toBe(true);
});

test('a 40 m frontage and 38 rear corners take bounded snapping choices', () => {
	const rear = Array.from({ length: 38 }, (_, i): Vec2 => {
		const x = 40 * (1 - i / 37);
		return [x, 16 + (x * (40 - x)) / 400];
	});
	const ring: Vec2[] = [[0, 0], [40, 0], ...rear];
	const space = createStripSpace(parcel(ring));
	expect(area(space)).toBeCloseTo(shoelace(ring), 9);
	for (const { quad } of space.cells) expect(isConvexCounterclockwise(quad)).toBe(true);
});

test('two adjacent frontage edges give the same strip addresses after rotating the ring', () => {
	const shape = {
		...parcel([
			[0, 0],
			[30, 0],
			[30, 10],
			[0, 10]
		]),
		frontage: [parcelEdgeId('c0', 'c1'), parcelEdgeId('c1', 'c2')]
	};
	const corners = [...shape.corners.slice(1), shape.corners[0]];
	expect(createStripSpace({ ...shape, corners })).toEqual(createStripSpace(shape));
});
