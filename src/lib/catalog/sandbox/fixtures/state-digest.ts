import { createHash } from 'node:crypto';
import type { World } from '../../logic/sandbox';

type State = World['state'];
const digests = new WeakMap<State, string>();

function write(value: unknown, hash: ReturnType<typeof createHash>): void {
	if (value === null || typeof value !== 'object') {
		hash.update(JSON.stringify(value) ?? 'undefined');
		return;
	}
	if (Array.isArray(value)) {
		hash.update('[');
		for (const item of value) {
			write(item, hash);
			hash.update(',');
		}
		hash.update(']');
		return;
	}
	const entries = value instanceof Map ? [...value.entries()] : Object.entries(value);
	entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
	hash.update(value instanceof Map ? 'map{' : '{');
	for (const [key, item] of entries) {
		write(key, hash);
		hash.update(':');
		write(item, hash);
		hash.update(',');
	}
	hash.update('}');
}

/** Streams a digest of the saved city and caches only by weak state identity. */
export function stateDigest(state: State) {
	const known = digests.get(state);
	if (known) return known;
	const hash = createHash('sha256');
	write(state, hash);
	const digest = hash.digest('hex');
	digests.set(state, digest);
	return digest;
}
