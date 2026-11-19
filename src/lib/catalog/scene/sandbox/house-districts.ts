import type { Primitive } from '../../logic/parametrik/types';

/** Retains independently edited masses, batching their faces once per touched terrain chunk. */
export function houseDistricts() {
	const districts = new Map<string, Map<string, Primitive[]>>();
	const locations = new Map<string, string>();
	const dirty = new Set<string>();

	function remove(key: string) {
		const old = locations.get(key);
		if (old === undefined) return;
		districts.get(old)?.delete(key);
		locations.delete(key);
		dirty.add(old);
	}

	return {
		remove,
		set(chunk: string, key: string, parts: Primitive[]) {
			if (locations.get(key) !== chunk) remove(key);
			const members = districts.get(chunk) ?? new Map<string, Primitive[]>();
			if (members.get(key) === parts) return;
			members.set(key, parts);
			locations.set(key, chunk);
			districts.set(chunk, members);
			dirty.add(chunk);
		},
		flush(write: (chunk: string, parts: Primitive[]) => void) {
			for (const chunk of dirty) {
				const members = districts.get(chunk);
				if (!members) continue;
				const ordered = [...members].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
				write(
					chunk,
					ordered.flatMap(([, parts]) => parts)
				);
				if (!members.size) districts.delete(chunk);
			}
			dirty.clear();
		},
		reset() {
			for (const key of locations.keys()) remove(key);
		}
	};
}
