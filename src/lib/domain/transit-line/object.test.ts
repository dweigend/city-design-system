import { expect, test } from 'bun:test';
import { bounds } from '../../core/object';
import { example } from './example';
import { createStationPlatformObject } from './index';

test('builds an offset crosshead and station with distinct shelter supports', () => {
	const { pier, station } = example();
	expect(pier.anchors.map(({ position }) => position)).toEqual([
		[0, 0, 0],
		[2, 0, 8]
	]);
	expect(bounds(pier).max[0]).toBeGreaterThanOrEqual(2);
	expect(station.parts.map(({ slot }) => slot)).toEqual(['platform', 'bearing']);
	expect(station.anchors[0].position).toEqual([2, 0, 8]);
	expect(() => createStationPlatformObject('bad', [0, 0, 0], [0, 0])).toThrow(RangeError);
});
