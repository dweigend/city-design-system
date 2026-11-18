/** Returns a deterministic fraction in [0, 1) for a uint32 seed and integer counter. */
export function studienZufall(saat: number, i: number): number {
	let h = (saat ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0;
	h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
	h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
	return ((h ^ (h >>> 15)) >>> 0) / 0x100000000;
}
