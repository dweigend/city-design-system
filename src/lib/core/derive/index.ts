/** Module: Memoizes derived values by scope, local key and input revision. */
import { required } from '../invariant';
import { encodeKey, type Key } from '../ref';

/** Returns a pull memo that retains the latest successful revision of each key.
 * Scopes are weakly held. An optional positive integer limit evicts the oldest inserted key
 * when a scope is full. A failing computation leaves the previous entry intact. */
export function createDeriveCache<Scope extends object, Value>(maxKeysPerScope = Infinity) {
	if (
		maxKeysPerScope !== Infinity &&
		(!Number.isSafeInteger(maxKeysPerScope) || maxKeysPerScope < 1)
	)
		throw new RangeError('Expected a positive cache key limit');
	const scopes = new WeakMap<Scope, Map<string, { revision: string; value: Value }>>();
	return (scope: Scope, key: Key, revision: string | Key, compute: () => Value): Value => {
		const id = encodeKey(key);
		const revisionId = typeof revision === 'string' ? 's' + revision : 'k' + encodeKey(revision);
		let entries = scopes.get(scope);
		if (!entries) {
			entries = new Map();
			scopes.set(scope, entries);
		}
		const entry = entries.get(id);
		if (entry?.revision === revisionId) return entry.value;
		const value = compute();
		if (!entries.has(id) && entries.size >= maxKeysPerScope)
			entries.delete(required(entries.keys().next().value, 'oldest cached key'));
		entries.set(id, { revision: revisionId, value });
		return value;
	};
}
