/** Mulberry32. Same integer seed produces the same sequence, without global state. */
export function random(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
export const nextSeed = (seed: number) => Math.floor(random(seed)() * 4294967296);
