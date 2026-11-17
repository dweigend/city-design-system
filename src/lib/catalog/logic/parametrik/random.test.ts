import { describe, expect, test } from 'bun:test';
import { nextSeed, random } from './random';

/** Draws `n` values from a fresh generator. */
const draws = (seed: number, n: number) => {
	const rng = random(seed);
	return Array.from({ length: n }, () => rng());
};

/**
 * PD-2/PD-3/PD-6: the PRNG contract. The public API is `random(seed) → () => number` and
 * `nextSeed(seed)`. The generator state is closed over and not exported, so continuation means
 * "the same live closure keeps drawing"; there is no checkpoint (PD-8).
 */
describe('random: seed normalization (PD-2)', () => {
	test('seeds are reduced to an integer in [0, 2³²) with `>>> 0`', () => {
		const ref = (seed: number) => draws(seed, 4);
		expect(ref(-1)).toEqual(ref(4294967295));
		expect(ref(4294967296)).toEqual(ref(0));
		expect(ref(4294967296 + 5)).toEqual(ref(5));
		expect(ref(1.9)).toEqual(ref(1));
		expect(ref(-0.5)).toEqual(ref(0));
		expect(ref(Number.NaN)).toEqual(ref(0));
		expect(ref(Number.POSITIVE_INFINITY)).toEqual(ref(0));
		expect(ref(1)).not.toEqual(ref(0));
	});
});

describe('random: draw sequence (PD-6)', () => {
	test('golden sequence for seed 45 and seed 0 (Mulberry32, frozen)', () => {
		// Integer-only arithmetic divided by 2³²: exact in every IEEE-754 runtime.
		expect(draws(45, 6)).toEqual([
			0.03719550580717623, 0.913797999965027, 0.7866767104715109, 0.3746803442481905,
			0.4594856023322791, 0.4819310246966779
		]);
		expect(draws(0, 3)).toEqual([0.26642920868471265, 0.0003297457005828619, 0.2232720274478197]);
	});

	test('every draw is a multiple of 2⁻³² in [0, 1) (bounded seeded loop)', () => {
		const seeds = draws(2026, 32).map((u) => Math.floor(u * 4294967296));
		for (const seed of [0, 4294967295, ...seeds])
			for (const u of draws(seed, 200)) {
				expect(u).toBeGreaterThanOrEqual(0);
				expect(u).toBeLessThan(1);
				expect(Number.isInteger(u * 4294967296)).toBe(true);
			}
	});

	test('nextSeed is the first draw scaled to an integer seed in [0, 2³²)', () => {
		expect([nextSeed(45), nextSeed(0), nextSeed(-1)]).toEqual([159753481, 1144304738, 3850105811]);
		for (const seed of [0, 1, 45, 4294967295]) {
			const next = nextSeed(seed);
			expect(next).toBe(Math.floor(draws(seed, 1)[0] * 4294967296));
			expect(Number.isInteger(next) && next >= 0 && next < 4294967296).toBe(true);
		}
	});
});

describe('random: continuation and isolation (PD-3, PD-8)', () => {
	test('a generator after k draws continues exactly like an uninterrupted run', () => {
		const ref = draws(19, 64);
		for (const k of [0, 1, 7, 33]) {
			const rng = random(19);
			for (let i = 0; i < k; i++) rng();
			expect(Array.from({ length: 64 - k }, () => rng())).toEqual(ref.slice(k));
		}
	});

	test('instances with the same seed share no state, even when interleaved', () => {
		const a = random(7),
			b = random(7),
			fromA: number[] = [],
			fromB: number[] = [];
		for (let i = 0; i < 10; i++) {
			fromA.push(a(), a());
			fromB.push(b());
		}
		expect(fromA).toEqual(draws(7, 20));
		expect(fromB).toEqual(draws(7, 10));
	});
});
