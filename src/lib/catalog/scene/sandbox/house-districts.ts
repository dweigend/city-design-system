import { townStock } from './town-stock';
import type { Object3D } from 'three/webgpu';
import type { Primitive } from '../../logic/parametrik/types';

/** Retains independently edited masses, batching their faces once per touched terrain chunk. */
export function houseDistricts() {
	const districts = new Map<string, Map<string, Primitive[]>>();
	const locations = new Map<string, string>();
	const dirty = new Set<string>();

	const sources = new Map<string, Primitive[]>();
	const targets = new WeakMap<Primitive[], Object3D[]>();
	let overview = false;

	function remove(key: string) {
		const old = locations.get(key);
		if (old === undefined) return;
		districts.get(old)?.delete(key);
		locations.delete(key);
		dirty.add(old);
	}

	function visibleParts(chunk: string, parts: Primitive[], write: (parts: Primitive[]) => void) {
		const stock = overview ? parts.filter((p) => p.role === 'bestand') : [];
		if (!stock.length) {
			if (sources.delete(chunk)) write([]);
			return parts;
		}
		sources.set(chunk, stock);
		write(townStock(stock));
		return parts.filter((p) => p.role !== 'bestand');
	}

	return {
		remove,
		/** Source geometry omitted from town rendering still owns its ray intersections. */
		stockTargets(build: (parts: Primitive[]) => Object3D[]) {
			return [...sources.values()].flatMap((parts) => {
				const known = targets.get(parts);
				if (known) return known;
				const built = build(parts);
				targets.set(parts, built);
				return built;
			});
		},
		setOverview(next: boolean) {
			if (overview === next) return;
			overview = next;
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
		flush(write: (chunk: string, parts: Primitive[], visual?: boolean) => void) {
			for (const chunk of dirty) {
				const members = districts.get(chunk);
				if (!members) continue;
				const ordered = [...members].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
				const parts = ordered.flatMap(([, group]) => group);
				write(
					chunk,
					visibleParts(chunk, parts, (stock) => write(chunk, stock, true))
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
