/** Module: Carries opaque, world-scoped addresses across library and storage boundaries. */

// Exact arithmetic: serial format discriminator.
const version = 1;

/** Versioned JSON address. The producing adapter owns its world, kind vocabulary and local keys. */
export type WorldReference<Kind extends string = string> = Readonly<{
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
): WorldReference<Kind> {
	if (!world || !kind || !key) throw new RangeError('Reference fields must be nonempty');
	return Object.freeze({ v: version, world, kind, key });
}

/** Reads a JSON reference in the current version. Returns undefined for invalid or unknown versions. */
export function readWorldReference(input: unknown): WorldReference | undefined {
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
