import { stockMasses } from './stock-masses';
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
	let refreshMasses = false;

	function remove(key: string) {
		const old = locations.get(key);
		if (old === undefined) return;
		districts.get(old)?.delete(key);
		locations.delete(key);
		dirty.add(old);
	}

	function visibleParts(chunk: string, parts: Primitive[]) {
		const stock = overview ? parts.filter((p) => p.role === 'bestand') : [];
		if (!stock.length) {
			sources.delete(chunk);
			return parts;
		}
		sources.set(chunk, stock);
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
				const parts = ordered.flatMap(([, group]) => group);
				write(chunk, visibleParts(chunk, parts));
				if (!members.size) districts.delete(chunk);
			}
			dirty.clear();
		},
		reset() {
			for (const key of locations.keys()) remove(key);
		}
	};
}
