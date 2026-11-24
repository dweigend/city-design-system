import { expect, test } from 'bun:test';
import { createPolygonIndex } from './index';
import { example } from './example';

test('reads closed edges and corners in input order', () => {
	const index = example();
	expect(index.readPoint([0, 0])?.id).toBe('holding');
	expect(index.readPoint([0, 1])?.id).toBe('holding');
	expect(index.readPoint([1, 1])?.id).toBe('holding');
	expect(index.readPoint([2, 1])?.id).toBe('holding');
	expect(index.readPoint([3, 3])?.id).toBe('neighbor');
});

test('respects concave cutouts and outside queries', () => {
	const index = example();
	expect(index.readPoint([0.5, 2])?.id).toBe('holding');
	expect(index.readPoint([2, 2])?.id).toBe('neighbor');
	expect(index.readPoint([4, 2])).toBeUndefined();
	expect(createPolygonIndex([]).readPoint([0, 0])).toBeUndefined();
});

test('finds crossed and touched polygons in travel order even with both endpoints outside', () => {
	const index = example();
	expect(index.readSegment([-1, 2], [4, 2]).map(({ id }) => id)).toEqual(['holding', 'neighbor']);
	expect(index.readSegment([4, 2], [-1, 2]).map(({ id }) => id)).toEqual(['neighbor', 'holding']);
	expect(index.readSegment([4, 3], [2, 3]).map(({ id }) => id)).toEqual(['neighbor']);
	expect(index.readSegment([2, 4], [4, 4])).toEqual([]);
});

test('finds the exact diagonal of a non-axis-aligned ring at zero margin', () => {
	const index = createPolygonIndex([
		{
			id: 'triangle',
			outline: [
				[0, 0],
				[22, 22],
				[0, 22]
			]
		}
	]);
	expect(index.readPoint([15, 15])?.id).toBe('triangle');
	expect(index.readPoint([15, 15.000001])?.id).toBe('triangle');
	expect(index.readPoint([15, 14.999999])).toBeUndefined();
});
