import { expect, test } from 'bun:test';
import { example } from './example';

test('drapes quad borders exactly onto the rendered terrain, splitting at folds', () => {
	const { object, drawables } = example();
	expect(object.slots).toEqual(['cell']);
	expect(drawables[0].finish).toBe('line');
	const shape = drawables[0].shape;
	if (shape.kind !== 'mesh') throw Error('Expected a mesh');
	const centers = new Set(shape.indices.filter((_, i) => i % 3 === 0));
	let cuts = 0;
	for (let i = 0; i < shape.positions.length / 3; i++) {
		if (centers.has(i)) continue;
		const [x, y, z] = shape.positions.slice(3 * i, 3 * i + 3);
		expect(z).toBeCloseTo(x >= y ? (x - y) / 4 : (y - x) / 2, 9);
		if (Math.abs(x - y) < 1e-9) cuts++;
	}
	expect(cuts).toBeGreaterThan(6);
});
