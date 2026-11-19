/**
 * Counter-based randomness for the building-block library (PROCEDURAL_PRINCIPLES PD-5).
 * A value is a pure function of seed, identity and channel: query order, neighbors and
 * call count play no role, so a local edit never reshuffles decisions elsewhere.
 * Independent core module: imports nothing.
 */

/**
 * Stateless random fraction in [0, 1).
 * @param seed integer seed; read as u32
 * @param id integer identity of the element that asks (stable index, never a coordinate)
 * @param channel integer purpose of the draw; one channel per decision
 */
export function hash(seed: number, id: number, channel: number): number {
	let h = (seed >>> 0) ^ Math.imul(id + 1, 0x9e3779b1) ^ Math.imul(channel + 1, 0x85ebca6b);
	h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
	h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
	h ^= h >>> 16;
	return (h >>> 0) / 4294967296;
}

/** Returns a fresh Mulberry32 stream seeded from the low 32 bits of the input.
 * Each call advances only this stream and yields a fraction in [0, 1).
 */
export function random(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
/** Returns the first draw of a fresh stream as a new unsigned 32-bit seed. */
export const nextSeed = (seed: number): number => Math.floor(random(seed)() * 4294967296);

/** Pure hash in [0,1), seed as u32; little-endian seed bytes, UTF-8 parts each preceded by NUL. */
export function hashUnit(seed: number, ...parts: (string | number)[]): number {
	let h = 2166136261;
	const byte = (b: number) => {
		h = Math.imul(h ^ b, 16777619);
	};
	for (let i = 0; i < 4; i++) byte((seed >>> (8 * i)) & 255);
	for (const part of parts) {
		byte(0);
		for (const b of new TextEncoder().encode(String(part))) byte(b);
	}
	h ^= h >>> 16;
	h = Math.imul(h, 0x85ebca6b);
	h ^= h >>> 13;
	h = Math.imul(h, 0xc2b2ae35);
	h ^= h >>> 16;
	return (h >>> 0) / 4294967296;
}
