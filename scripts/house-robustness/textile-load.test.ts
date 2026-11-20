import { expect, test } from 'bun:test';
import { membraneResponse, type Membrane } from '../../src/lib/catalog/logic/membrane';

const cloth: Membrane = { pressure: 2, tension: 1, restraint: 'net' };
test('intersecting diagonal cables and both floor edges hold a loaded membrane', () => {
	for (const [u, v] of [
		[0, 0.5],
		[1, 0.5],
		[0.25, 0],
		[0.25, 1],
		[0.25, 0.5],
		[0.75, 0.5]
	]) {
		expect(membraneResponse(cloth, 6, 8, u, v, 2).fraction).toBeCloseTo(0, 12);
	}
	expect(membraneResponse(cloth, 6, 8, 0.5, 0.5, 2).fraction).toBeGreaterThan(0);
});
test('equal pressure to tension ratios produce the same bulge; pressure relieves gravitational sag', () => {
	const sample = (pressure: number, tension: number) =>
		membraneResponse({ ...cloth, pressure, tension }, 6, 8, 0.5, 0.5, 2);
	const released = sample(0, 1),
		inflated = sample(2, 1);
	expect(released.fraction).toBe(0);
	expect(inflated.fraction).toBeCloseTo(sample(4, 2).fraction, 12);
	expect(inflated.sag).toBeLessThan(released.sag);
	expect(inflated.sag).toBeGreaterThan(0);
	expect(inflated.fraction).toBeLessThan(1);
});
