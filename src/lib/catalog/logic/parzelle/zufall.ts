export const CHANNEL = {
	slice: 'slice',
	use: 'use',
	passage: 'passage',
	event: 'event',
	priority: 'priority',
	split: 'split',
	target: 'target'
};
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
