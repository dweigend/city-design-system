import { expect, test } from 'bun:test';
import { assetRegistry, buildObject } from './index';

test('every access object offers at least three variants', () => {
	for (const asset of assetRegistry.filter((entry) => entry.category === 'access'))
		expect(new Set(asset.variants).size).toBeGreaterThanOrEqual(3);
});

test('landings retain a level bearing with one chamfer on the corner plate', () => {
	for (const [variant, width, corners] of [
		['standard', 1.25, 4],
		['mast-platform', 2.5, 4],
		['corner', 1.25, 5]
	] as const) {
		const [p] = buildObject('landing', variant, 17).geometry;
		if (p.kind !== 'prism') throw Error('Expected landing plate');
		expect(p.height).toBe(0.2);
		expect(p.polygon).toHaveLength(corners);
		for (const [axis, half] of [
			[0, width / 2],
			[1, 0.625]
		] as const) {
			expect(Math.min(...p.polygon.map((q) => q[axis]))).toBe(-half);
			expect(Math.max(...p.polygon.map((q) => q[axis]))).toBe(half);
		}
	}
});

test('ramp decks and both solid cheeks follow the eight percent grade', () => {
	for (const [variant, run] of [
		['standard', 2.5],
		['medium', 5],
		['long', 7.5]
	] as const) {
		const parts = buildObject('ramp', variant, 17).geometry;
		expect(parts).toHaveLength(3);
		for (const p of parts) {
			if (p.kind !== 'wedge') throw Error('Expected ramp wedge');
			expect(p.size[0]).toBe(run);
			expect((p.size[2] * (1 - (p.low ?? 0))) / run).toBeCloseTo(0.08);
			expect(p.size[1]).toBeGreaterThanOrEqual(0.2);
			expect(Math.abs(p.position[1] + p.size[1] / 2) + p.size[1] / 2).toBeLessThanOrEqual(0.625);
		}
	}
});

test('railings share one centred deck reservation', () => {
	for (const variant of ['standard', 'parapet', 'screen']) {
		const { footprint, anchors, geometry } = buildObject('railing', variant, 17);
		expect(footprint).toEqual([2.5, 0.15]);
		expect(anchors).toEqual([{ attachment: 'deck', position: [0, 0, 0], normal: [0, 0, 1] }]);
		for (const p of geometry) {
			if (p.kind === 'pipe') {
				expect(p.radius * 2).toBeGreaterThanOrEqual(0.12);
				for (const [x, y] of p.points) {
					expect(Math.abs(x)).toBeLessThanOrEqual(1.25);
					expect(y).toBe(0);
				}
			} else if (p.kind === 'box') {
				expect(Math.min(...p.size)).toBeGreaterThanOrEqual(0.12);
				expect(p.position[0]).toBeGreaterThanOrEqual(-1.25);
				expect(p.position[0] + p.size[0]).toBeLessThanOrEqual(1.25);
			} else throw Error('Unexpected railing member');
		}
	}
});
