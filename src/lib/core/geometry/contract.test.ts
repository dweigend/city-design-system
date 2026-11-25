import { expect, test } from 'bun:test';
import {
	bounds,
	crossProduct,
	displacement,
	distance,
	dotProduct,
	interpolation,
	isSimplePolygon,
	isSimpleRing,
	length,
	measurePointSegmentDistance,
	measurePolygon,
	readVertexMean,
	scaled,
	size,
	sum,
	unitVector,
	type Vec2,
	type Vec3
} from './index';

test('computes detached metric vector results', () => {
	const from = Object.freeze([1, 2, 3] as const);
	const to = Object.freeze([4, 6, 3] as const);
	expect(sum(from, to)).toEqual([5, 8, 6]);
	expect(displacement(from, to)).toEqual([3, 4, 0]);
	expect(scaled(to, 0.5)).toEqual([2, 3, 1.5]);
	expect(dotProduct(from, to)).toBe(25);
	expect(crossProduct([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
	expect(length([3, 4, 12])).toBe(13);
	expect(distance(from, to)).toBe(5);
	expect(distance([1, 2], [4, 6])).toBe(5);
	expect(interpolation(from, to, 0.5)).toEqual([2.5, 4, 3]);
	expect(interpolation(from, to, 0)).toEqual(from);
	expect(interpolation(from, to, 0)).not.toBe(from);
});

test('normalizes nonzero vectors, including subnormal components', () => {
	expect(unitVector([3, 4, 0])).toEqual([0.6, 0.8, 0]);
	expect(unitVector([Number.MIN_VALUE, 0, 0])).toEqual([1, 0, 0]);
	expect(() => unitVector([0, 0, 0])).toThrow(RangeError);
});

test('measures the envelope in XY and height along Z', () => {
	const point = Object.freeze([-2, 3, 1] as const);
	const points: readonly Vec3[] = Object.freeze([point, [3, -4, 6] as const]);
	expect(bounds(points)).toEqual({ min: [-2, -4, 1], max: [3, 3, 6] });
	const singleton = bounds([point]);
	expect(singleton?.min).not.toBe(point);
	expect(singleton?.max).not.toBe(point);
	expect(size({ min: [-2, -4, 1], max: [3, 3, 6] })).toEqual([5, 7, 5]);
	expect(bounds([])).toBeUndefined();
});

test('measures a five-meter square at the world coordinate limit', () => {
	for (const offset of [0, 999_999_900]) {
		const square = [
			[offset, offset],
			[offset + 5, offset],
			[offset + 5, offset + 5],
			[offset, offset + 5]
		] as const;
		expect(measurePolygon(square)).toEqual({ area: 25, centroid: [offset + 2.5, offset + 2.5] });
	}
});

test('measures the minimum distance to the interior or either end of a segment', () => {
	expect(measurePointSegmentDistance([2, 3], [0, 0], [4, 0])).toBe(3);
	expect(measurePointSegmentDistance([-3, 4], [0, 0], [4, 0])).toBe(5);
	expect(measurePointSegmentDistance([7, 4], [0, 0], [4, 0])).toBe(5);
	expect(measurePointSegmentDistance([3, 4], [0, 0], [0, 0])).toBe(5);
});

test('averages vertices in order with either division policy', () => {
	const ring = [
		[0, 0],
		[4, 0],
		[2, 2],
		[0, 2]
	] as const;
	expect(readVertexMean(ring)).toEqual([1.5, 1]);
	expect(measurePolygon(ring).centroid).not.toEqual(readVertexMean(ring));
	const points = [
		[1e16, 1],
		[1, 1],
		[-1e16, 1]
	] as const;
	expect(readVertexMean(points)).toEqual([0, 1]);
	expect(readVertexMean(points, 'before-sum')).toEqual([0.5, 1]);
	expect(readVertexMean([])).toEqual([NaN, NaN]);
	expect(readVertexMean([], 'before-sum')).toEqual([0, 0]);
});

const crossingRings: Readonly<Record<string, readonly Vec2[]>> = {
	// Visit alternate vertices of a regular pentagon. Each turn is +144°.
	pentagram: Array.from({ length: 5 }, (_, i) => [
		10 + 8 * Math.cos((4 * Math.PI * i) / 5),
		10 + 8 * Math.sin((4 * Math.PI * i) / 5)
	]),
	bowtie: [
		[0, 0],
		[8, 8],
		[0, 10],
		[4, 0]
	]
};

test.each(Object.entries(crossingRings))('Q-05 rejects the self-crossing %s', (_name, ring) => {
	expect(isSimpleRing(ring)).toBe(false);
});

test('Q-05 permits a concave ring with a straight run but rejects retracing and repeated vertices', () => {
	expect(
		isSimpleRing([
			[0, 0],
			[2, 0],
			[4, 0],
			[4, 4],
			[2, 2],
			[0, 4]
		])
	).toBe(true);
	expect(
		isSimpleRing([
			[0, 0],
			[4, 0],
			[2, 0],
			[4, 4],
			[0, 4]
		])
	).toBe(false);
	expect(
		isSimpleRing([
			[0, 0],
			[4, 0],
			[2, 2],
			[4, 4],
			[2, 2],
			[0, 4]
		])
	).toBe(false);
	expect(
		isSimpleRing([
			[0, 0],
			[4, 0],
			[4, 4],
			[2, 0],
			[0, 4]
		])
	).toBe(false);
	expect(
		isSimpleRing([
			[0, 0],
			[4, 0]
		])
	).toBe(false);
});

test('Q-05 uses exact orientation for large-coordinate triangles in both windings', () => {
	const n = 2 ** 27;
	const triangle: readonly Vec2[] = [
		[0, 0],
		[n + 1, n],
		[n, n - 1]
	];
	expect(isSimpleRing(triangle)).toBe(true);
	expect(isSimpleRing([...triangle].reverse())).toBe(true);
});

test('isSimplePolygon requires disjoint strictly interior non-nested holes', () => {
	const outer: readonly Vec2[] = [
		[0, 0],
		[40, 0],
		[40, 40],
		[0, 40]
	];
	const leftHole: readonly Vec2[] = [
		[4, 4],
		[14, 4],
		[14, 14],
		[4, 14]
	];
	const rightHole: readonly Vec2[] = [
		[20, 20],
		[30, 20],
		[30, 30],
		[20, 30]
	];
	expect(isSimplePolygon(outer, [leftHole, rightHole])).toBe(true);
	// Disjoint hole outside the outer ring.
	expect(
		isSimplePolygon(outer, [
			[
				[50, 50],
				[60, 50],
				[60, 60],
				[50, 60]
			]
		])
	).toBe(false);
	// Hole touching the outer ring.
	expect(
		isSimplePolygon(outer, [
			[
				[0, 10],
				[10, 10],
				[10, 20],
				[0, 20]
			]
		])
	).toBe(false);
	// Overlapping holes.
	expect(
		isSimplePolygon(outer, [
			leftHole,
			[
				[10, 10],
				[20, 10],
				[20, 20],
				[10, 20]
			]
		])
	).toBe(false);
	// Nested holes.
	expect(
		isSimplePolygon(outer, [
			leftHole,
			[
				[6, 6],
				[12, 6],
				[12, 12],
				[6, 12]
			]
		])
	).toBe(false);
	// Hole enclosing the outer ring.
	expect(isSimplePolygon(leftHole, [outer])).toBe(false);
});
