import { expect, test } from 'bun:test';
import { clipPolylineToSquare, polylineLength, sinuosity } from './index';
import { polylineExample } from './example';

test('measures the straight reach independently of clipping and leaves its input unchanged', () => {
	const line = [-4, -2, 4, 2];
	const reach = polylineExample();
	expect(reach?.xy).toEqual(new Float64Array([-1, -0.5, 1, 0.5]));
	expect(reach?.borderHits).toBe(2);
	expect(polylineLength(line)).toBe(Math.hypot(8, 4));
	expect(sinuosity(line)).toBe(1);
	expect(clipPolylineToSquare([2, 2, 3, 3], 2)).toBeNull();
	expect(line).toEqual([-4, -2, 4, 2]);
});
