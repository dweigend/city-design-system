import { expect, test } from 'bun:test';
import { valleyTriangleBudget } from './index';
import { valleyProjectionExample } from './example';

test('projects the full window in meters as terrain and water within the triangle budget', () => {
	const { object, drawables, triangleCount } = valleyProjectionExample();
	expect(object.footprint).toEqual({ width: 2000, depth: 2000 });
	expect(object.slots).toEqual(['ground', 'water']);
	expect(object.parts.every(({ shape }) => shape.kind === 'mesh')).toBe(true);
	expect(drawables.map(({ finish }) => finish)).toEqual(['terrain', 'matte']);
	expect(triangleCount).toBeGreaterThan(12_800);
	expect(triangleCount).toBeLessThanOrEqual(valleyTriangleBudget);
	expect(drawables[0].shape).toBe(object.parts[0].shape);
});
