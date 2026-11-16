import { canonical, GENERATOR_VERSION, STATE_FORMAT, type ParcelState } from './typen';
import {
	areaTolerance,
	edges,
	isSimple,
	points,
	segmentIntersection,
	signedArea
} from './geometrie';
/** Checks the state without mutation; new findings list, coordinates m, areas m², no exceptions on reference errors. */
export function validateState(state: ParcelState): { code: string; detail: string }[] {
	const issues: { code: string; detail: string }[] = [];
	const add = (code: string, detail: string) => issues.push({ code, detail });
	if (state.format !== STATE_FORMAT || state.generatorVersion !== GENERATOR_VERSION)
		add('invalid-format', 'Format/generator version');
	const ids = new Set<string>();
	for (const v of state.vertices) {
		if (ids.has(v.id)) add('duplicate-id', v.id);
		ids.add(v.id);
		if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) add('nonfinite-coordinate', v.id);
	}
	const used = new Set<string>(),
		owners = new Map<string, string[]>(),
		parcelIds = new Set<string>();
	let total = 0;
	for (const p of state.parcels) {
		if (parcelIds.has(p.id)) add('duplicate-id', p.id);
		parcelIds.add(p.id);
		for (const id of p.ring) used.add(id);
		if (p.ring.some((id) => !ids.has(id))) {
			add('unknown-vertex', p.id);
			continue;
		}
		const ps = points(state, p),
			area = signedArea(ps);
		total += area;
		if (p.ring.length < 3 || !isSimple(ps)) add('invalid-ring', p.id);
		if (area <= areaTolerance(area)) add('ring-not-ccw', p.id);
		for (const e of edges(p.ring)) {
			const key = JSON.stringify(e);
			owners.set(key, [...(owners.get(key) ?? []), p.id]);
		}
	}
	const boundary = new Set(state.boundary.map((e) => JSON.stringify([e.from, e.to])));
	for (const e of state.boundary) {
		used.add(e.from);
		used.add(e.to);
		if (!ids.has(e.from) || !ids.has(e.to)) add('unknown-vertex', e.from);
		if (owners.get(JSON.stringify([e.from, e.to]))?.length !== 1) add('boundary-unpaired', e.from);
	}
	if (boundary.size !== state.boundary.length)
		add('duplicate-boundary', 'Boundary edge duplicated');
	for (let i = 0; i < state.boundary.length; i++)
		if (state.boundary[i].to !== state.boundary[(i + 1) % state.boundary.length].from)
			add('boundary-order', String(i));
	for (const [key, list] of owners) {
		const [a, b]: string[] = JSON.parse(key);
		if (
			list.length !== 1 ||
			(!boundary.has(key) && owners.get(JSON.stringify([b, a]))?.length !== 1) ||
			(boundary.has(key) && owners.has(JSON.stringify([b, a])))
		)
			add('edge-unpaired', key);
	}
	const segments = state.parcels.flatMap((p) =>
		p.ring.every((id) => ids.has(id))
			? edges(p.ring).map(([a, b], i) => ({
					owner: p.id,
					a,
					b,
					p: points(state, p)[i],
					q: points(state, p)[(i + 1) % p.ring.length]
				}))
			: []
	);
	for (let i = 0; i < segments.length; i++)
		for (let j = i + 1; j < segments.length; j++) {
			const a = segments[i],
				b = segments[j];
			if (a.owner !== b.owner && segmentIntersection(a.p, a.q, b.p, b.q, true))
				add('edge-crossing', `${a.owner}/${b.owner}`);
		}
	if (state.boundary.every((e) => ids.has(e.from))) {
		const area = signedArea(points(state, { ring: state.boundary.map((e) => e.from) }));
		if (Math.abs(total - area) > areaTolerance(area)) add('area-sum', `${total}/${area}`);
	}
	for (const id of ids) if (!used.has(id)) add('orphan-vertex', id);
	return issues;
}
/** Canonical JSON with fixed key order as a new string; input unchanged. */
export function encodeState(state: ParcelState): string {
	const s = canonical(state);
	return JSON.stringify({
		format: s.format,
		generatorVersion: s.generatorVersion,
		seed: s.seed,
		blockId: s.blockId,
		epoch: s.epoch,
		vertices: s.vertices.map((v) => ({ id: v.id, x: v.x, y: v.y })),
		boundary: s.boundary.map((e) => ({ from: e.from, to: e.to, access: e.access })),
		parcels: s.parcels.map((p) => ({
			id: p.id,
			ring: p.ring,
			use: p.use,
			bornEpoch: p.bornEpoch,
			parents: p.parents,
			isProtected: p.isProtected
		})),
		log: s.log.map((e) => ({
			epoch: e.epoch,
			kind: e.kind,
			parcelIds: e.parcelIds,
			resultIds: e.resultIds,
			...(e.code ? { code: e.code } : {})
		}))
	});
}
