import { expect, test } from 'bun:test';
import { plateExample } from './example';

test('builds a plate with paint groups, metric footprint and a face anchor', () => {
	const { object, groups } = plateExample();
	expect(object.footprint).toEqual({ width: 2, depth: 1 });
	expect(object.anchors).toEqual([{ name: 'face', position: [0, 0, 0.12], normal: [0, 0, 1] }]);
	expect(groups[0].family).toBe('cork');
	expect(object.parts.length).toBeGreaterThan(0);
	expect(plateExample().object).toEqual(object);
});
