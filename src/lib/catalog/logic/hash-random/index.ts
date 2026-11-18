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
