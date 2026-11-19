import { stockMasses } from './stock-masses';
import type { Primitive } from '../../logic/parametrik/types';

/** Retains independently edited masses, batching their faces once per touched terrain chunk. */
export function houseDistricts() {
	const districts = new Map<string, Map<string, Primitive[]>>();
	const locations = new Map<string, string>();
	const dirty = new Set<string>();

	let overview = false;
	let refreshMasses = false;

	function remove(key: string) {
		const old = locations.get(key);
		if (old === undefined) return;
		districts.get(old)?.delete(key);
		locations.delete(key);
		dirty.add(old);
	}

	return {
		remove,
		setOverview(next: boolean) {
			if (overview === next) return;
			overview = next;
			refreshMasses = true;
			for (const chunk of districts.keys()) dirty.add(chunk);
		},
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
			if ((overview && dirty.size) || refreshMasses) {
				const parts = [...districts.values()].flatMap((members) => [...members.values()].flat());
				write('stock-overview', overview ? stockMasses(parts) : []);
				refreshMasses = false;
			}
			for (const chunk of dirty) {
				const members = districts.get(chunk);
				if (!members) continue;
				const ordered = [...members].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
				write(
					chunk,
					ordered.flatMap(([, parts]) =>
						overview ? parts.filter((p) => p.role !== 'bestand') : parts
					)
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
