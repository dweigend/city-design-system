import { expect, test } from 'bun:test';
import { example } from './example';

test('offers a darkening shade and a visible joint stroke', () => {
	const { castShade, pencilStroke } = example();
	expect(castShade).toBeLessThan(0);
	expect(pencilStroke.width).toBeGreaterThan(0);
});
