/**
 * Deterministic cache key of a serializable input: same content, same key, whatever the order of
 * object properties. Array order is content and stays. No clock, no counter, no identity.
 */

/** Canonical JSON: object keys ascending, arrays as given, `undefined` properties dropped. */
export function kanonisch(wert: unknown): string {
	if (Array.isArray(wert)) return `[${wert.map(kanonisch).join(',')}]`;
	if (wert !== null && typeof wert === 'object') {
		const eintraege = Object.entries(wert as Record<string, unknown>)
			.filter(([, v]) => v !== undefined)
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
		return `{${eintraege.map(([k, v]) => `${JSON.stringify(k)}:${kanonisch(v)}`).join(',')}}`;
	}
	return JSON.stringify(wert) ?? 'null';
}

/** FNV-1a over UTF-16 code units, 32 bit, from a given offset basis. */
function fnv1a(text: string, basis: number): number {
	let h = basis;
	for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
	return h >>> 0;
}

/**
 * 64 bit key as 16 hex digits from two independent FNV-1a passes over the canonical JSON.
 * A key is an address, no proof of equality: a store that must not confuse inputs keeps the
 * canonical text beside the result.
 */
export function schluessel(eingabe: unknown): string {
	const text = kanonisch(eingabe);
	const hex = (n: number) => n.toString(16).padStart(8, '0');
	return hex(fnv1a(text, 0x811c9dc5)) + hex(fnv1a(text, 0x01234567));
}
