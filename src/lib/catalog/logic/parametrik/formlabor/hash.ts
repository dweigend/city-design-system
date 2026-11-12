/**
 * Stateless randomness: hash(seed, id, channel) → [0, 1).
 * Every slot queries its number directly. Order and neighbors play no role,
 * so decisions hold still while morphing (101 §4, D1–D7).
 */
export function hash(saat: number, id: number, kanal: number): number {
	let h = (saat >>> 0) ^ Math.imul(id + 1, 0x9e3779b1) ^ Math.imul(kanal + 1, 0x85ebca6b);
	h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
	h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
	h ^= h >>> 16;
	return (h >>> 0) / 4294967296;
}

export const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
/** Exact at both ends (t = 0 and t = 1), so the path hits every type bit for bit. */
export const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;
export const smooth = (a: number, b: number, v: number) => {
	const t = clamp((v - a) / (b - a));
	return t * t * (3 - 2 * t);
};
/** Soft threshold: 0 below the random number, 1 above it. Turns “present / absent” into growth. */
export const schwelle = (wert: number, zufall: number, weich = 0.06) =>
	smooth(zufall - weich, zufall + weich, wert * (1 + 2 * weich) - weich);
