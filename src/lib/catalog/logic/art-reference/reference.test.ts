import { expect, test } from 'bun:test';
import { composeCollage, buildVessel } from './index';
const cell = [
	[0, 0],
	[12, 0],
	[12, 3],
	[4, 3],
	[4, 10],
	[0, 10]
] as const;
test('a notched cell leaves the missing quadrant untouched', () => {
	const pieces = composeCollage(cell, 17);
	expect(pieces.length).toBeGreaterThan(2);
	for (const p of pieces) {
		expect(p.x - p.radius).toBeGreaterThanOrEqual(0);
		expect(p.y - p.radius).toBeGreaterThanOrEqual(0);
		expect(p.x + p.radius).toBeLessThanOrEqual(12);
		expect(p.y + p.radius).toBeLessThanOrEqual(10);
		expect(Math.hypot(Math.max(0, 4 - p.x), Math.max(0, 3 - p.y))).toBeGreaterThanOrEqual(p.radius);
	}
});
test('stock reserves a gap and retains its prefix as density increases', () => {
	const sparse = composeCollage(cell, 19, { count: 3 });
	const dense = composeCollage(cell, 19, { count: 9 });
	expect(dense.slice(0, 3)).toEqual(sparse);
	for (const [i, p] of dense.entries())
		for (const q of dense.slice(i + 1))
			expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThan(p.radius + q.radius);
});
test('seed replay reproduces layouts and profiles', () => {
	for (const generate of [composeCollage, buildVessel]) {
		expect(generate(cell, 9)).toEqual(generate(cell, 9 + 2 ** 32));
		expect(generate(cell, 9)).not.toEqual(generate(cell, 10));
	}
});
test('the pierced body stays inside its support disc at every elevation', () => {
	const vessel = buildVessel(cell, 2)!;
	for (const ring of vessel.rings) {
		expect(Math.abs(ring.offset) + ring.outer).toBeLessThanOrEqual(vessel.base.radius);
		expect(ring.inner).toBeGreaterThan(0);
		expect(ring.inner).toBeLessThan(ring.outer);
	}
	expect(vessel.rings.at(-1)!.z).toBeGreaterThan(vessel.rings[0].z);
});
test('empty cells emit nothing and invalid controls fail at the boundary', () => {
	expect(composeCollage([], 2)).toEqual([]);
	expect(buildVessel([], 2)).toBeNull();
	expect(() => composeCollage(cell, 2, { count: 0 })).toThrow(RangeError);
});
