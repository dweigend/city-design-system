import { expect, test } from 'bun:test';
import { Valley } from '../../domain/valley';
import { projectValley, valleyTriangleBudget } from './index';

test('frames the regional reach as a cut block within the triangle budget', () => {
	const valley = Valley.create({ seed: 1201 });
	const { object, heightScale, drawables, triangleCount } = projectValley(valley);
	expect(object.footprint.width).toBeCloseTo(8079, 0);
	expect(object.footprint.depth).toBe(3800);
	expect(heightScale).toBe(8);
	expect(object.slots).toEqual(['ground', 'earth', 'water']);
	expect(drawables.map(({ finish }) => finish)).toEqual(['terrain', 'matte', 'matte']);
	expect(triangleCount).toBeLessThanOrEqual(valleyTriangleBudget);
	expect(drawables[0].shape).toBe(object.parts[0].shape);
});

test('applies one scale to bed, water and cut sides, keeping XY fixed', () => {
	const valley = Valley.create({ seed: 1201 });
	const natural = projectValley(valley, 1);
	const exaggerated = projectValley(valley, 8);
	for (const [index, { shape }] of natural.object.parts.entries()) {
		const raised = exaggerated.object.parts[index].shape;
		if (shape.kind !== 'mesh' || raised.kind !== 'mesh') throw new Error('Expected mesh');
		expect(raised.indices).toEqual(shape.indices);
		for (const [component, value] of shape.positions.entries()) {
			expect(raised.positions[component]).toBeCloseTo(value * (component % 3 === 2 ? 8 : 1), 9);
		}
	}
	expect(() => projectValley(valley, 0)).toThrow(RangeError);
});
