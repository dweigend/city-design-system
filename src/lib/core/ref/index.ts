/** Module: Encodes local keys and carries world-scoped addresses. */

/** Values with a distinct representation in a key tuple. Numbers must be finite. */
export type KeyAtom = string | number | boolean | null;

/** An ordered tuple of local key components. */
export type Key = readonly KeyAtom[];

/** Encodes a tuple as a canonical JSON array, with negative zero written as zero.
 * The input is unchanged. Non-array inputs and invalid atoms throw RangeError. */
export function encodeKey(key: Key): string {
	if (!Array.isArray(key)) throw new RangeError('Expected a key tuple');
	const atoms = Array.from(key, (atom: unknown): KeyAtom => {
		if (atom === null || typeof atom === 'string' || typeof atom === 'boolean') return atom;
		if (typeof atom === 'number' && Number.isFinite(atom)) return atom;
		throw new RangeError('Expected a finite key atom');
	});
	return JSON.stringify(atoms);
}

/** Encodes an unordered pair of strings or tuples without mutating them. String pairs are
 * sorted by their original UTF-16 code units. Pairs containing tuples are sorted by the
 * code units of each encoded endpoint. Throws RangeError for an invalid tuple atom. */
export function encodePair(a: string | Key, b: string | Key): string {
	if (typeof a === 'string' && typeof b === 'string')
		return JSON.stringify(a < b ? [a, b] : [b, a]);
	const first = typeof a === 'string' ? JSON.stringify(a) : encodeKey(a);
	const second = typeof b === 'string' ? JSON.stringify(b) : encodeKey(b);
	return first < second ? `[${first},${second}]` : `[${second},${first}]`;
}

// Exact arithmetic: serial format discriminator.
const version = /* Exact arithmetic: reference codec version. */ 1;

/** Versioned JSON address. The producing adapter owns its world, kind vocabulary and local keys. */
export type Ref<Kind extends string = string> = Readonly<{
	v: typeof version;
	world: string;
	kind: Kind;
	key: string;
}>;

/** A lookup distinguishes an absent address from an unusable reference or scope. */
export type ReferenceResolution<Value> =
	| Readonly<{ status: 'resolved'; value: Value }>
	| Readonly<{ status: 'invalid-reference' | 'different-world' | 'unsupported-kind' | 'missing' }>;

/** Creates a version-one address from an assigned scope, kind and local key. */
export function createWorldReference<Kind extends string>(
	world: string,
	kind: Kind,
	key: string
): Ref<Kind> {
	if (!world || !kind || !key) throw new RangeError('Reference fields must be nonempty');
	return Object.freeze({ v: version, world, kind, key });
}

/** Reads a JSON reference in the current version. Returns undefined for invalid or unknown versions. */
export function readWorldReference(input: unknown): Ref | undefined {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return;
	const { v, world, kind, key } = input as Record<string, unknown>;
	if (
		v === version &&
		typeof world === 'string' &&
		world &&
		typeof kind === 'string' &&
		kind &&
		typeof key === 'string' &&
		key
	)
		return createWorldReference(world, kind, key);
}

/** Tests whether two valid references name the same world, kind and local key. */
export function equalRefs(a: Ref, b: Ref): boolean {
	return a.world === b.world && a.kind === b.kind && a.key === b.key;
}
