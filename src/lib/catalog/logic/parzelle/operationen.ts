import {
	canonical,
	failure,
	type Outcome,
	type ParcelState,
	type ParcelUse,
	type Point
} from './typen';
import {
	cross,
	edges,
	isConvex,
	isSimple,
	lerp,
	norm,
	points,
	signedArea,
	SPLIT_CLEARANCE,
	sub
} from './geometrie';
/** Splits a convex parcel with a line in m; new detached result or error, never mutation. */
export function splitParcel(
	state: ParcelState,
	parcelId: string,
	line: { point: Point; direction: Point },
	childIds: [string, string] = [`${parcelId}.0`, `${parcelId}.1`]
): Outcome<ParcelState> {
	const parent = state.parcels.find((p) => p.id === parcelId);
	if (!parent) return failure('unknown-parcel');
	if (parent.isProtected) return failure('protected');
	const ps = points(state, parent);
	if (!isConvex(ps)) return failure('nonconvex');
	const len = norm(line.direction);
	if (!len || !Number.isFinite(len) || !line.point.every(Number.isFinite))
		return failure('degenerate-split');
	const distances = ps.map((p) => cross(line.direction, sub(p, line.point)) / len);
	if (distances.some((d) => !Number.isFinite(d) || Math.abs(d) < SPLIT_CLEARANCE))
		return failure('degenerate-split');
	const hits: { index: number; id: string; point: Point }[] = [];
	for (let i = 0; i < ps.length; i++)
		if (distances[i] * distances[(i + 1) % ps.length] < 0)
			hits.push({
				index: i,
				id: `${parcelId}#${hits.length}`,
				point: lerp(
					ps[i],
					ps[(i + 1) % ps.length],
					distances[i] / (distances[i] - distances[(i + 1) % ps.length])
				)
			});
	// Reused IDs (such as a split after a merge) are rejected deterministically.
	if (
		hits.length !== 2 ||
		hits.some((h) => state.vertices.some((v) => v.id === h.id)) ||
		childIds[0] === childIds[1] ||
		childIds.some((id) => state.parcels.some((p) => p.id === id && p.id !== parcelId))
	)
		return failure('degenerate-split');
	const next = canonical(state),
		rings: [string[], string[]] = [[], []];
	for (let i = 0; i < ps.length; i++) {
		rings[distances[i] > 0 ? 0 : 1].push(parent.ring[i]);
		const hit = hits.find((h) => h.index === i);
		if (hit) {
			rings[0].push(hit.id);
			rings[1].push(hit.id);
		}
	}
	for (const hit of hits) {
		const a = parent.ring[hit.index],
			b = parent.ring[(hit.index + 1) % ps.length];
		next.vertices.push({ id: hit.id, x: hit.point[0], y: hit.point[1] });
		for (const p of next.parcels)
			if (p.id !== parcelId) {
				const j = p.ring.findIndex((v, i) => v === b && p.ring[(i + 1) % p.ring.length] === a);
				if (j >= 0) p.ring.splice(j + 1, 0, hit.id);
			}
		const j = next.boundary.findIndex((e) => e.from === a && e.to === b);
		if (j >= 0) {
			const e = next.boundary[j];
			next.boundary.splice(j, 1, { ...e, to: hit.id }, { ...e, from: hit.id });
		}
	}
	next.parcels = next.parcels.filter((p) => p.id !== parcelId);
	next.parcels.push(
		...rings.map((ring, i) => ({
			...parent,
			id: childIds[i],
			ring,
			bornEpoch: state.epoch,
			parents: [parcelId],
			isProtected: false
		}))
	);
	return { ok: true, value: canonical(next) };
}
/** Merges two neighbors in m; keep retains use/ID; new result or error, no mutation. */
export function mergeParcels(
	state: ParcelState,
	keepId: string,
	absorbId: string
): Outcome<ParcelState> {
	const keep = state.parcels.find((p) => p.id === keepId),
		absorb = state.parcels.find((p) => p.id === absorbId);
	if (!keep || !absorb) return failure('unknown-parcel');
	if (keep.isProtected || absorb.isProtected) return failure('protected');
	if (keepId === absorbId) return failure('not-adjacent');
	const a = edges(keep.ring),
		b = edges(absorb.ring),
		shared = a.filter(([u, v]) => b.some(([x, y]) => x === v && y === u));
	if (!shared.length) return failure('not-adjacent');
	const sharedVertices = new Set(shared.flat());
	const connected = new Set([shared[0][0]]);
	for (let i = 0; i < shared.length; i++)
		for (const [u, v] of shared)
			if (connected.has(u) || connected.has(v)) {
				connected.add(u);
				connected.add(v);
			}
	if (connected.size !== sharedVertices.size) return failure('merge-not-simple');
	const outer = [
		...a.filter(([u, v]) => !shared.some(([x, y]) => x === u && y === v)),
		...b.filter(([u, v]) => !shared.some(([x, y]) => x === v && y === u))
	];
	const ring = [outer[0][0]];
	let cursor = outer[0][1];
	for (let i = 1; i < outer.length; i++) {
		if (ring.includes(cursor)) return failure('merge-not-simple');
		ring.push(cursor);
		const candidates = outer.filter(([u]) => u === cursor);
		if (candidates.length !== 1) return failure('merge-not-simple');
		cursor = candidates[0][1];
	}
	if (
		cursor !== ring[0] ||
		!isSimple(points(state, { ring })) ||
		signedArea(points(state, { ring })) <= 0
	)
		return failure('merge-not-simple');
	const next = canonical(state);
	next.parcels = next.parcels.filter((p) => p.id !== absorbId && p.id !== keepId);
	next.parcels.push({ ...keep, ring, parents: [...keep.parents, absorbId] });
	const used = new Set([
		...next.parcels.flatMap((p) => p.ring),
		...next.boundary.flatMap((e) => [e.from, e.to])
	]);
	next.vertices = next.vertices.filter((v) => used.has(v.id));
	return { ok: true, value: canonical(next) };
}
/** Sets the use; detached state or unknown-parcel/protected, input unchanged. */
export function convertParcel(
	state: ParcelState,
	parcelId: string,
	use: ParcelUse
): Outcome<ParcelState> {
	const p = state.parcels.find((p) => p.id === parcelId);
	if (!p) return failure('unknown-parcel');
	if (p.isProtected) return failure('protected');
	const next = canonical(state);
	for (const q of next.parcels) if (q.id === parcelId) q.use = use;
	return { ok: true, value: next };
}
/** Sets existing stock for IDs atomically; new state or unknown-parcel, no mutation. */
export function setProtection(
	state: ParcelState,
	parcelIds: string[],
	isProtected: boolean
): Outcome<ParcelState> {
	if (parcelIds.some((id) => !state.parcels.some((p) => p.id === id)))
		return failure('unknown-parcel');
	const next = canonical(state);
	for (const p of next.parcels) if (parcelIds.includes(p.id)) p.isProtected = isProtected;
	return { ok: true, value: next };
}
