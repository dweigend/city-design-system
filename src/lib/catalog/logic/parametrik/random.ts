/**
 * Mulberry32 generator. The seed is normalized with `seed >>> 0` to an integer in [0, 2³²)
 * (fractions truncate, negatives wrap, NaN and ±Infinity become 0). Returns a live closure that
 * owns its state; each call advances it by one draw and yields a multiple of 2⁻³² in [0, 1).
 * Instances share no state. The draw sequence is frozen in random.test.ts; the state cannot be
 * exported or restored (no checkpoint, PD-8).
 */
export function random(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
/** Reroll: the first draw of `random(seed)` scaled to an integer seed in [0, 2³²). Pure. */
export const nextSeed = (seed: number) => Math.floor(random(seed)() * 4294967296);
