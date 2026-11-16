// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { describe, expect, test } from 'bun:test';
import { fein, grob, kreisSegmente, pfeilhoehe, SEHNENFEHLER_M } from './rundung';

describe('kreisSegmente', () => {
	test('pipe 0.35 m: 24 instead of the former 12 segments, deviation below 4 mm', () => {
		const n = kreisSegmente(0.35);
		expect(n).toBe(24);
		expect(pfeilhoehe(0.35, n)).toBeLessThanOrEqual(SEHNENFEHLER_M);
		// The old 12-gon deviated by almost 12 mm: nearly three times the tolerance.
		expect(pfeilhoehe(0.35, 12)).toBeGreaterThan(2.9 * SEHNENFEHLER_M);
	});

	test('tube transit 1.6 m needs more segments than a service pipe', () => {
		expect(kreisSegmente(1.6)).toBe(48);
		expect(kreisSegmente(1.6)).toBeGreaterThan(kreisSegmente(0.35));
	});

	test('a large dome hits the upper bound, a tiny strut the lower bound', () => {
		expect(kreisSegmente(12)).toBe(fein.max);
		expect(kreisSegmente(0.02)).toBe(fein.min);
	});

	test('coarse for world views: clearly fewer segments, bounds respected', () => {
		expect(kreisSegmente(0.35, grob)).toBe(8);
		expect(kreisSegmente(3, grob)).toBe(20);
		expect(kreisSegmente(50, grob)).toBe(grob.max);
	});

	test('an invalid radius returns the lower bound, the result is always a multiple of 4', () => {
		for (const r of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
			expect(kreisSegmente(r)).toBe(fein.min);
		for (let r = 0.05; r < 20; r *= 1.37) expect(kreisSegmente(r) % 4).toBe(0);
	});
});
