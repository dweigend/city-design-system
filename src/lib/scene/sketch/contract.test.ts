import { describe, expect, test } from 'bun:test';
import { example } from './example';

describe('sketch', () => {
	test('draws the three visible sides of a cube, far to near, inside its view box', () => {
		const { viewBox, faces } = example();
		expect(faces).toHaveLength(6);
		expect(new Set(faces.map(({ shade }) => shade))).toEqual(new Set(['top', 'lit', 'shadow']));
		expect(faces.every(({ tone }) => tone === '--model-white')).toBe(true);
		const [x, y, width, height] = viewBox.split(' ').map(Number);
		for (const { points } of faces)
			for (const pair of points.split(' ')) {
				const [px, py] = pair.split(',').map(Number);
				expect(px).toBeGreaterThanOrEqual(x);
				expect(py).toBeLessThanOrEqual(y + height + 1e-9);
				expect(px).toBeLessThanOrEqual(x + width + 1e-9);
			}
	});
});
