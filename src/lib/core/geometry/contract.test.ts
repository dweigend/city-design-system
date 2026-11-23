import { measurePolygon } from './index';
import { expect, test } from 'bun:test';
import {
	bounds,
	crossProduct,
	displacement,
	distance,
	dotProduct,
	interpolation,
	length,
	scaled,
	size,
	sum,
	unitVector,
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
