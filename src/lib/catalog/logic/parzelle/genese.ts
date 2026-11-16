import {
	ACCESS_CLASSES,
	byId,
	canonical,
	DEFAULT_RULES,
	failure,
	GENERATOR_VERSION,
	isPublic,
	PRIVATE_USES,
	STATE_FORMAT,
	type BlockSpec,
	type ErrorCode,
	type Outcome,
	type Parcel,
	type ParcelRules,
	type ParcelState,
	type Point
} from './typen';
import {
	areaTolerance,
	cross,
	dot,
	edges,
	isSimple,
	lengthTolerance,
	lerp,
	lineIntersection,
	norm,
	points,
	signedArea,
	SPLIT_CLEARANCE,
	sub
} from './geometrie';
import { accessOf, neighbors, parcelArea } from './zugang';
import { mergeParcels, splitParcel } from './operationen';
import { validateState } from './invarianten';
import { CHANNEL, hashUnit } from './zufall';
/** Creates a CCW block in m; default rules, new data or ring/seed error, no mutation. */
export function createBlock(
	spec: BlockSpec,
	seed: number,
	rules: ParcelRules = DEFAULT_RULES
): Outcome<ParcelState> {
	if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) return failure('invalid-seed');
	if (
		spec.ring.length < 3 ||
		spec.edges.length !== spec.ring.length ||
		spec.edges.some((e) => !ACCESS_CLASSES[e]) ||
		spec.ring.some((p) => !p.every(Number.isFinite)) ||
		!isSimple(spec.ring)
	)
		return failure('invalid-ring');
	if (signedArea(spec.ring) <= 0) return failure('not-ccw');
	const state: ParcelState = {
		format: STATE_FORMAT,
		generatorVersion: GENERATOR_VERSION,
		seed,
		blockId: spec.id,
		epoch: 0,
		vertices: [],
		boundary: [],
		parcels: [],
		log: []
	};
	for (let i = 0; i < spec.ring.length; i++) {
		const p = spec.ring[i];
		state.vertices.push({ id: `${spec.id}:v${i}`, x: p[0], y: p[1] });
	}
	if (
		spec.stops?.some(
			(s) =>
				!Number.isInteger(s.edge) ||
				s.edge < 0 ||
				s.edge >= spec.ring.length ||
				!Number.isFinite(s.t) ||
				s.t <= 0 ||
				s.t >= 1
		)
	)
		return failure('invalid-ring', 'Invalid transit stop');
	for (let i = 0; i < spec.ring.length; i++) {
		const a = spec.ring[i],
			b = spec.ring[(i + 1) % spec.ring.length],
			length = norm(sub(b, a));
		let from = `${spec.id}:v${i}`,
			last = 0;
		const stops = (spec.stops ?? [])
			.map((s, k) => ({ ...s, k }))
			.filter((s) => s.edge === i)
			.sort((a, b) => a.t - b.t || a.k - b.k);
		for (const s of stops) {
			const lo = Math.max(SPLIT_CLEARANCE / length, s.t - rules.stopFront / (2 * length)),
				hi = Math.min(1 - SPLIT_CLEARANCE / length, s.t + rules.stopFront / (2 * length));
			// Overlapping stop intervals are not specified: reject atomically as invalid-ring.
			if (lo <= last || hi <= lo)
				return failure('invalid-ring', 'Overlapping/too short stop intervals');
			const ids = [`${spec.id}:s${s.k}a`, `${spec.id}:s${s.k}b`];
			for (const [j, t] of [lo, hi].entries()) {
				const p = lerp(a, b, t);
				state.vertices.push({ id: ids[j], x: p[0], y: p[1] });
			}
			state.boundary.push(
				{ from, to: ids[0], access: spec.edges[i] },
				{ from: ids[0], to: ids[1], access: 'stop' }
			);
			from = ids[1];
			last = hi;
		}
		state.boundary.push({
			from,
			to: `${spec.id}:v${(i + 1) % spec.ring.length}`,
			access: spec.edges[i]
		});
	}
	state.parcels = [
		{
			id: spec.id,
			ring: state.boundary.map((e) => e.from),
			use: 'mixed',
			bornEpoch: 0,
			parents: [],
			isProtected: false
		}
	];
	return { ok: true, value: canonical(state) };
}
function strips(input: ParcelState, rules: ParcelRules): Outcome<ParcelState> {
	if (!input.boundary.some((e) => ACCESS_CLASSES[e.access].grantsAccess))
		return failure('landlocked-block');
	const s = canonical(input),
		p = points(s, { ring: s.boundary.map((e) => e.from) }),
		n = p.length,
		d = s.boundary.map((e) => rules.stripDepth?.[e.access] ?? ACCESS_CLASSES[e.access].stripDepth),
		q: Point[] = [],
		qIds: string[] = [];
	for (let i = 0; i < n; i++) {
		const prev = (i + n - 1) % n,
			u = sub(p[i], p[prev]),
			v = sub(p[(i + 1) % n], p[i]);
		if (d[prev] === 0 && d[i] === 0) {
			q.push(p[i]);
			qIds.push(s.boundary[i].from);
			continue;
		}
		const a: Point = [p[i][0] - (u[1] / norm(u)) * d[prev], p[i][1] + (u[0] / norm(u)) * d[prev]],
			b: Point = [p[i][0] - (v[1] / norm(v)) * d[i], p[i][1] + (v[0] / norm(v)) * d[i]];
		// Collinear depth jumps use the following normal without a foot-point staircase.
		const point = lineIntersection(a, u, b, v) ?? b;
		q.push(point);
		qIds.push(`${s.blockId}:q${i}`);
		s.vertices.push({ id: qIds[i], x: point[0], y: point[1] });
		if (d[prev] === 0 || d[i] === 0) {
			const j = d[prev] === 0 ? prev : i,
				t =
					dot(sub(point, p[j]), sub(p[(j + 1) % n], p[j])) /
					dot(sub(p[(j + 1) % n], p[j]), sub(p[(j + 1) % n], p[j]));
			if (t <= 0 || t >= 1) return failure('skeleton-event');
		}
	}
	const parcel = (id: string, ring: string[]): Parcel => ({
		id,
		ring: [...new Set(ring)],
		use: 'mixed',
		parents: [s.blockId],
		bornEpoch: 0,
		isProtected: false
	});
	s.parcels = [];
	for (let i = 0; i < n; i++)
		if (d[i] > 0) {
			if (dot(sub(q[(i + 1) % n], q[i]), sub(p[(i + 1) % n], p[i])) <= 0)
				return failure('skeleton-event');
			s.parcels.push(
				parcel(`${s.blockId}.s${i}`, [
					s.boundary[i].from,
					s.boundary[i].to,
					qIds[(i + 1) % n],
					qIds[i]
				])
			);
		}
	s.parcels.push(parcel(`${s.blockId}.k`, qIds));
	// Q on an outer edge is computed once and inserted into ALL affected rings.
	const splitEdge = (a: string, b: string): string[] => {
		const vertices = new Map(s.vertices.map((v) => [v.id, [v.x, v.y] as Point])),
			pa = vertices.get(a),
			pb = vertices.get(b);
		if (!pa || !pb) return [];
		const v = sub(pb, pa),
			l = norm(v);
		return s.vertices
			.filter((w) => w.id !== a && w.id !== b)
			.map((w) => ({
				id: w.id,
				t: dot(sub([w.x, w.y], pa), v) / (l * l),
				dist: Math.abs(cross(v, sub([w.x, w.y], pa))) / l
			}))
			.filter((w) => w.t > 0 && w.t < 1 && w.dist <= lengthTolerance(l))
			.sort((a, b) => a.t - b.t)
			.map((w) => w.id);
	};
	for (const parcel of s.parcels)
		parcel.ring = edges(parcel.ring).flatMap(([a, b]) => [a, ...splitEdge(a, b)]);
	s.boundary = s.boundary.flatMap((e) => {
		const ids = [e.from, ...splitEdge(e.from, e.to), e.to];
		return ids.slice(0, -1).map((a, i) => ({ ...e, from: a, to: ids[i + 1] }));
	});
	if (
		s.parcels.some(
			(p) => !isSimple(points(s, p)) || parcelArea(s, p.id) <= areaTolerance(parcelArea(s, p.id))
		) ||
		validateState(s).length
	)
		return failure('skeleton-event');
	return { ok: true, value: canonical(s) };
}
function merged(state: ParcelState, keep: string, absorb: string): Outcome<ParcelState> {
	const result = mergeParcels(state, keep, absorb);
	if (result.ok)
		result.value.log.push({
			epoch: 0,
			kind: 'merge',
			parcelIds: [keep, absorb],
			resultIds: [keep]
		});
	return result;
}
/** Initial subdivision by perimeter strips/slices/core/remainder rules; new result in m/m², atomic errors, no mutation. */
export function parcelize(
	input: ParcelState,
	rules: ParcelRules = DEFAULT_RULES
): Outcome<{ state: ParcelState; issues: { code: ErrorCode; parcelId: string }[] }> {
	if (input.parcels.length !== 1 || input.epoch !== 0)
		return failure('invalid-ring', 'Single-parcel block expected');
	// Existing stock stays unchanged: a protected block is not subdivided.
	if (input.parcels[0].isProtected) return failure('protected');
	const initial = strips(input, rules);
	if (!initial.ok) return initial;
	let s = initial.value;
	const issues: { code: ErrorCode; parcelId: string }[] = [];
	for (const [i, e] of input.boundary.entries()) {
		const stripId = `${s.blockId}.s${i}`;
		if (!s.parcels.some((p) => p.id === stripId)) continue;
		const [a, b] = points(input, { ring: [e.from, e.to] }),
			v = sub(b, a),
			count = e.access === 'stop' ? 1 : Math.max(1, Math.round(norm(v) / rules.frontTarget));
		let rest = stripId;
		for (let j = 1; j < count; j++) {
			const t =
				(j + rules.irregularity * (hashUnit(s.seed, stripId, j, CHANNEL.slice) - 0.5) * 0.8) /
				count;
			const result = splitParcel(s, rest, { point: lerp(a, b, t), direction: [-v[1], v[0]] }, [
				`${stripId}.p${j - 1}`,
				`${stripId}.r${j}`
			]);
			if (result.ok) {
				s = result.value;
				rest = `${stripId}.r${j}`;
			} else if (result.code !== 'degenerate-split') return result; // Degenerate slices stay uncut.
		}
		const p = s.parcels.find((p) => p.id === rest);
		if (p) p.id = `${stripId}.p${count - 1}`;
	}
	for (const p of s.parcels)
		if (
			edges(p.ring).some(([a, b]) =>
				s.boundary.some((e) => e.from === a && e.to === b && e.access === 'stop')
			)
		)
			p.use = 'hub';
	const coreId = `${s.blockId}.k`,
		core = s.parcels.find((p) => p.id === coreId);
	if (core && parcelArea(s, coreId) < rules.commonsAreaMin) {
		for (const n of neighbors(s, coreId).sort((a, b) => b.length - a.length || byId(a, b))) {
			const result = merged(s, n.id, coreId);
			if (result.ok) {
				s = result.value;
				break;
			}
		}
	} else if (core) {
		core.use = 'commons';
		let success = false;
		const access = accessOf(s);
		const candidates = neighbors(s, coreId)
			.map((n) => s.parcels.find((p) => p.id === n.id))
			.filter(
				(p): p is Parcel =>
					!!p &&
					!isPublic(p.use) &&
					(access.get(p.id)?.front ?? 0) >= rules.passageWidth + rules.frontMin
			)
			.sort(
				(a, b) =>
					hashUnit(s.seed, a.id, CHANNEL.passage) - hashUnit(s.seed, b.id, CHANNEL.passage) ||
					byId(a, b)
			);
		for (const p of candidates) {
			const fronts = edges(p.ring)
				.filter(([a, b]) =>
					s.boundary.some(
						(e) => e.from === a && e.to === b && ['footway', 'green', 'square'].includes(e.access)
					)
				)
				.map(([a, b]) => {
					const [pa, pb] = points(s, { ring: [a, b] });
					return { a: pa, b: pb, length: norm(sub(pb, pa)) };
				})
				.sort((a, b) => b.length - a.length);
			const front = fronts[0];
			if (!front) continue;
			const v = sub(front.b, front.a);
			for (const end of [false, true]) {
				const result = splitParcel(
					s,
					p.id,
					{
						point: lerp(
							front.a,
							front.b,
							end ? 1 - rules.passageWidth / front.length : rules.passageWidth / front.length
						),
						direction: [-v[1], v[0]]
					},
					end ? [`${p.id}.m`, `${p.id}.d`] : [`${p.id}.d`, `${p.id}.m`]
				);
				if (!result.ok) continue;
				const next = result.value,
					passage = next.parcels.find((q) => q.id === `${p.id}.d`);
				if (passage) passage.use = 'passage';
				if (
					!neighbors(next, `${p.id}.d`).some((n) => n.id === coreId) ||
					parcelArea(next, `${p.id}.m`) < rules.areaMin ||
					(accessOf(next).get(`${p.id}.m`)?.front ?? 0) < rules.frontMin
				)
					continue;
				s = next;
				success = true;
				break;
			}
			if (success) break;
		}
		if (!success) issues.push({ code: 'no-access', parcelId: coreId });
	}
	for (const mode of ['size-rule', 'no-access'] as const) {
		const budget = s.parcels.length + 1;
		for (let step = 0; step < budget; step++) {
			let changed = false;
			for (const p of [...s.parcels].sort(byId)) {
				if (!s.parcels.some((q) => q.id === p.id) || isPublic(p.use) || p.isProtected) continue;
				const access = accessOf(s),
					front = access.get(p.id)?.front ?? 0;
				// Minimum frontage only on access edges: a parcel that lies only on the courtyard has no frontage.
				if (
					mode === 'size-rule'
						? parcelArea(s, p.id) >= rules.areaMin && front >= rules.frontMin
						: (access.get(p.id)?.levels.length ?? 0) > 0
				)
					continue;
				const ns = neighbors(s, p.id)
					.filter((n) => {
						const q = s.parcels.find((p) => p.id === n.id);
						return (
							q &&
							!isPublic(q.use) &&
							!q.isProtected &&
							(mode === 'size-rule' || (access.get(n.id)?.levels.length ?? 0) > 0)
						);
					})
					.sort((a, b) => b.length - a.length || byId(a, b));
				for (const n of ns) {
					const result = merged(s, n.id, p.id);
					if (result.ok) {
						s = result.value;
						changed = true;
						break;
					}
				}
			}
			if (!changed) break;
		}
		for (const p of s.parcels)
			if (!isPublic(p.use)) {
				const a = accessOf(s).get(p.id);
				if (
					mode === 'size-rule'
						? parcelArea(s, p.id) < rules.areaMin || (a?.front ?? 0) < rules.frontMin
						: !a?.levels.length
				)
					issues.push({ code: mode, parcelId: p.id });
			}
	}
	for (const p of s.parcels)
		if (!isPublic(p.use)) p.use = PRIVATE_USES[Math.floor(hashUnit(s.seed, p.id, CHANNEL.use) * 4)];
	return { ok: true, value: { state: canonical(s), issues } };
}
