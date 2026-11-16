import { ACCESS_CLASSES, byId, isPublic, type ParcelState } from './typen';
import { edges, norm, points, signedArea, sub } from './geometrie';
/** Edge neighbors and shared length in m as a new list; valid topology assumed. */
export function neighbors(state: ParcelState, id: string): { id: string; length: number }[] {
	const p = state.parcels.find((p) => p.id === id);
	if (!p) return [];
	const reverse = new Set(edges(p.ring).map(([a, b]) => JSON.stringify([b, a])));
	return state.parcels
		.filter((q) => q.id !== id)
		.map((q) => {
			const ps = points(state, q);
			return {
				id: q.id,
				length: edges(q.ring).reduce(
					(s, e, i) =>
						s + (reverse.has(JSON.stringify(e)) ? norm(sub(ps[i], ps[(i + 1) % ps.length])) : 0),
					0
				)
			};
		})
		.filter((q) => q.length > 0)
		.sort(byId);
}
/**
 * Access levels, access length and frontage in m as a detached map; public fixpoint propagation,
 * no mutation. `frontage` counts all serving edges including courtyard and passage.
 * `front` measures only the own outward access edges (alley, square, elevated walkway, stop, green corridor);
 * the minimum frontage applies there (author decision David, 12.11.2026: the courtyard side does not count).
 */
export function accessOf(
	state: ParcelState
): Map<string, { levels: number[]; frontage: number; front: number }> {
	const direct = new Map(state.parcels.map((p) => [p.id, new Set<number>()]));
	const boundary = new Map(state.boundary.map((e) => [JSON.stringify([e.from, e.to]), e.access]));
	for (const p of state.parcels)
		for (const e of edges(p.ring)) {
			const cls = boundary.get(JSON.stringify(e));
			if (cls) for (const level of ACCESS_CLASSES[cls].levels) direct.get(p.id)?.add(level);
		}
	const reachable = new Set(
		state.parcels
			.filter((p) => isPublic(p.use) && (direct.get(p.id)?.size ?? 0) > 0)
			.map((p) => p.id)
	);
	for (let changed = true; changed;) {
		changed = false;
		for (const p of state.parcels)
			if (
				isPublic(p.use) &&
				!reachable.has(p.id) &&
				neighbors(state, p.id).some((n) => reachable.has(n.id))
			) {
				reachable.add(p.id);
				changed = true;
			}
	}
	const owners = new Map<string, string>();
	for (const p of state.parcels) for (const e of edges(p.ring)) owners.set(JSON.stringify(e), p.id);
	return new Map(
		state.parcels.map((p) => {
			const levels = new Set(direct.get(p.id)),
				ps = points(state, p);
			let frontage = 0,
				front = 0;
			for (const [i, [a, b]] of edges(p.ring).entries()) {
				const cls = boundary.get(JSON.stringify([a, b])),
					owner = owners.get(JSON.stringify([b, a]));
				const external = cls && ACCESS_CLASSES[cls].grantsAccess,
					internal = owner && reachable.has(owner),
					length = norm(sub(ps[(i + 1) % ps.length], ps[i]));
				if (external || internal) frontage += length;
				if (external) front += length;
				if (internal) levels.add(0);
			}
			return [p.id, { levels: [...levels].sort((a, b) => a - b), frontage, front }];
		})
	);
}
/** Mean depth in m as an approximation area/frontage; Infinity for frontage 0; pure. */
export function meanDepth(area: number, frontage: number): number {
	return frontage > 0 ? area / frontage : Infinity;
}
/** Parcel area in m², without mutation; the ID must exist. */
export function parcelArea(state: ParcelState, id: string): number {
	const p = state.parcels.find((p) => p.id === id);
	return p ? signedArea(points(state, p)) : 0;
}
