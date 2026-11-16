import type { FamilieId } from './plan';
/** FNV-1a over UTF-16 code units of a collision-free tuple, then seeded fmix32. */
export function kanal(
	saat: number,
	familie: FamilieId,
	elementId: string,
	kanalName: string
): number {
	let h = 0x811c9dc5;
	const text = JSON.stringify([familie, elementId, kanalName]);
	for (let i = 0; i < text.length; i++) {
		h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
	}
	h ^= saat >>> 0;
	h ^= h >>> 16;
	h = Math.imul(h, 0x85ebca6b);
	h ^= h >>> 13;
	h = Math.imul(h, 0xc2b2ae35);
	return (h ^ (h >>> 16)) >>> 0;
}
export function einheit(u32: number): number {
	return (u32 >>> 0) / 4294967296;
}
