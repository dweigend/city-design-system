import { required } from '../../../../required';
import {
	acceptable,
	area,
	inside,
	intersects,
	length,
	mix,
	onSegment,
	orient,
	quadQuality,
	sub,
	triangulate,
	validateRing
} from './geometry';
import { buildTopology, validateTopology } from './topology';
import {
	childId,
	edgeId,
	emptyMeaning,
	InvariantError,
	type Chunk,
	type Derivation,
	type Intent,
	type Model,
	type SourceFace,
	type Vec
} from './types';

function validateMeaning(m: ReturnType<typeof emptyMeaning>) {
	if (
		!['empty', 'reserved', 'occupied'].includes(m.occupancy) ||
		typeof m.role !== 'string' ||
		typeof m.protected !== 'boolean' ||
		new Set(m.programs.map((p) => p.level)).size !== m.programs.length ||
		m.programs.some(
			(p) =>
				!Number.isInteger(p.level) ||
				!Number.isFinite(p.height) ||
				p.height <= 0 ||
				typeof p.use !== 'string'
		)
	)
		throw new InvariantError('invalid-program');
}
export function validateIntent(intent: Intent, changed?: ReadonlySet<string>) {
	if (intent.version !== 1 || !Number.isSafeInteger(intent.seed))
		throw new InvariantError('invalid-version-seed');
	const l = intent.limits;
	if (
		!Object.values(l).every(Number.isFinite) ||
		l.minAngle <= 0 ||
		l.minAngle > 90 ||
		l.minJacobian <= 0 ||
		l.minJacobian > 1 ||
		l.minArea <= 0 ||
		l.maxAspect < 1
	)
		throw new InvariantError('invalid-limits');
	for (const id of intent.fixed)
		if (!intent.positions.has(id)) throw new InvariantError('unknown-fixed', [id]);
	for (const id of [...intent.positions.keys(), ...intent.faces.keys()])
		if (id.startsWith('mid:') || id.startsWith('derived:'))
			throw new InvariantError('reserved-id', [id]);
	for (const p of intent.positions.values())
		if (p.length !== 2 || !p.every(Number.isFinite)) throw new InvariantError('invalid-position');
	const faces = [...intent.faces.values()];
	for (const f of faces) {
		if (
			intent.faces.get(f.id) !== f ||
			!Number.isInteger(f.level) ||
			f.ring.some((v) => !intent.positions.has(v))
		)
			throw new InvariantError('invalid-source', [f.id]);
		if (!changed || changed.has(f.id)) {
			validateRing(f.ring.map((v) => required(intent.positions.get(v), 'intent.positions.get(v)')));
			if (f.parts) validateParts(intent, f);
		}
		const m = intent.semantics.get(f.id);
		if (!m) throw new InvariantError('missing-meaning', [f.id]);
		validateMeaning(m);
	}
	if (intent.semantics.size !== faces.length) throw new InvariantError('orphan-meaning');
	if (!changed) buildTopology(faces);
	const rings = faces.map((f) =>
		f.ring.map((v) => required(intent.positions.get(v), 'intent.positions.get(v)'))
	);
	const boxes = rings.map((ps) => [
		Math.min(...ps.map((p) => p[0])),
		Math.min(...ps.map((p) => p[1])),
		Math.max(...ps.map((p) => p[0])),
		Math.max(...ps.map((p) => p[1]))
	]);
	// Global separation: a changed region may collide with an arbitrarily distant cell.
	const active = faces.flatMap((f, i) => (!changed || changed.has(f.id) ? [i] : []));
	for (const i of active)
		for (let j = 0; j < faces.length; j++) {
			if (i === j || (j < i && (!changed || changed.has(faces[j].id)))) continue;
			const a = faces[i],
				b = faces[j];
			if (a.level !== b.level || (changed && !changed.has(a.id) && !changed.has(b.id))) continue;
			if (
				boxes[i][2] < boxes[j][0] ||
				boxes[j][2] < boxes[i][0] ||
				boxes[i][3] < boxes[j][1] ||
				boxes[j][3] < boxes[i][1]
			)
				continue;
			const pa = rings[i],
				pb = rings[j];
			if (pa.some((p) => inside(p, pb)) || pb.some((p) => inside(p, pa)))
				throw new InvariantError('overlap', [a.id, b.id]);
			for (let u = 0; u < pa.length; u++)
				for (let v = 0; v < pb.length; v++) {
					const ai = a.ring[u],
						aj = a.ring[(u + 1) % pa.length],
						bi = b.ring[v],
						bj = b.ring[(v + 1) % pb.length];
					if (edgeId(ai, aj) === edgeId(bi, bj)) continue;
					if (!intersects(pa[u], pa[(u + 1) % pa.length], pb[v], pb[(v + 1) % pb.length])) continue;
					const common = [ai, aj].filter((id) => id === bi || id === bj);
					if (common.length !== 1) throw new InvariantError('crossing-or-T-junction', [a.id, b.id]);
					const farA = ai === common[0] ? aj : ai,
						farB = bi === common[0] ? bj : bi;
					if (
						onSegment(
							required(intent.positions.get(farA), 'intent.positions.get(farA)'),
							pb[v],
							pb[(v + 1) % pb.length]
						) ||
						onSegment(
							required(intent.positions.get(farB), 'intent.positions.get(farB)'),
							pa[u],
							pa[(u + 1) % pa.length]
						)
					)
						throw new InvariantError('overlapping-edges', [a.id, b.id]);
				}
		}
}
/** Fixed boundary; repair only face centers, then triangulate this source face if needed. */
export function deriveChunk(
	intent: Intent,
	f: SourceFace,
	prefix = 'derived:' + encodeURIComponent(f.id)
): Chunk {
	if (f.parts) {
		const positions = new Map<string, Vec>(),
			quality = new Map(),
			provenance = new Map<string, Derivation>();
		provenance.set(f.id, { id: f.id, parent: null, rule: 'source', children: [] });
		const polygons: SourceFace[] = [];
		for (const [j, ring] of f.parts.entries()) {
			const id = childId('derived:' + encodeURIComponent(f.id), 'part', j);
			const chunk = deriveChunk(intent, { id: f.id, ring, level: f.level }, id);
			for (const [v, p] of chunk.geometry.positions) positions.set(v, p);
			for (const [v, q] of chunk.geometry.quality) quality.set(v, q);
			for (const node of chunk.provenance.values()) {
				if (node.id === f.id) continue;
				provenance.set(node.id, { ...node, parent: node.parent === f.id ? id : node.parent });
			}
			provenance.set(id, {
				id,
				parent: f.id,
				rule: 'part',
				children: required(chunk.provenance.get(f.id), 'chunk.provenance.get(f.id)').children
			});
			required(provenance.get(f.id), 'provenance.get(f.id)').children.push(id);
			for (const q of chunk.topology.faces.values())
				polygons.push({ id: q.id, ring: q.vertices, level: q.level });
		}
		return {
			root: f.id,
			topology: buildTopology(polygons),
			geometry: { positions, quality },
			provenance
		};
	}
	const initial = new Map(
		f.ring.map((id) => [id, required(intent.positions.get(id), 'intent.positions.get(id)')])
	);
	const convex = f.ring.every(
		(v, i) =>
			orient(
				required(initial.get(v), 'initial.get(v)'),
				required(
					initial.get(f.ring[(i + 1) % f.ring.length]),
					'initial.get(f.ring[(i + 1) % f.ring.length])'
				),
				required(
					initial.get(f.ring[(i + 2) % f.ring.length]),
					'initial.get(f.ring[(i + 2) % f.ring.length])'
				)
			) > 0
	);
	const attempts = convex
		? [[f.ring], triangulate(f.ring, initial)]
		: [triangulate(f.ring, initial)];
	for (const parts of attempts) {
		const positions = new Map(initial),
			provenance = new Map<string, Derivation>(),
			polygons: SourceFace[] = [];
		provenance.set(f.id, { id: f.id, parent: null, rule: 'source', children: [] });
		let valid = true;
		for (let j = 0; j < parts.length; j++) {
			const ring = parts[j],
				parent = childId(prefix, parts.length === 1 ? 'convex' : 'triangle', j),
				centerId = childId(parent, 'center', 0);
			required(provenance.get(f.id), 'provenance.get(f.id)').children.push(parent);
			provenance.set(parent, {
				id: parent,
				parent: f.id,
				rule: parts.length === 1 ? 'convex' : 'ear-clip',
				children: []
			});
			const ps = ring.map((id) => required(positions.get(id), 'positions.get(id)'));
			const center: Vec = [
				ps.reduce((s, p) => s + p[0], 0) / ps.length,
				ps.reduce((s, p) => s + p[1], 0) / ps.length
			];
			const mids = ring.map((id, i) => {
				const b = ring[(i + 1) % ring.length],
					mid = `mid:${edgeId(id, b)}`;
				const ends = [id, b].sort();
				positions.set(
					mid,
					mix(
						required(positions.get(ends[0]), 'positions.get(ends[0])'),
						required(positions.get(ends[1]), 'positions.get(ends[1])'),
						0.5
					)
				);
				return mid;
			});
			const qs = ring.map((v, i) => ({
				id: childId(parent, 'quad', i),
				ring: [v, mids[i], centerId, mids[(i + ring.length - 1) % ring.length]],
				level: f.level
			}));
			const centroid: [number, number] = [0, 0];
			const polygonArea = area(ps);
			ps.forEach((v, i) => {
				const w = ps[(i + 1) % ps.length],
					c = v[0] * w[1] - w[0] * v[1];
				centroid[0] += ((v[0] + w[0]) * c) / (6 * polygonArea);
				centroid[1] += ((v[1] + w[1]) * c) / (6 * polygonArea);
			});
			const candidates = prefix.includes('/part:') ? [centroid, center] : [center];
			// Deterministic bounded search inside the convex part; no remote vertex moves.
			for (const p of ps) for (const t of [0.125, 0.25, 0.5]) candidates.push(mix(center, p, t));
			let chosen: Vec | undefined;
			for (const p of candidates) {
				positions.set(centerId, p);
				if (
					qs.every((q) =>
						acceptable(
							quadQuality(q.ring.map((id) => required(positions.get(id), 'positions.get(id)'))),
							intent.limits
						)
					)
				) {
					chosen = p;
					break;
				}
			}
			if (!chosen) {
				valid = false;
				break;
			}
			for (const q of qs) {
				polygons.push(q);
				required(provenance.get(parent), 'provenance.get(parent)').children.push(q.id);
				provenance.set(q.id, { id: q.id, parent, rule: 'midpoint-quad', children: [] });
			}
		}
		if (valid) {
			const topology = buildTopology(polygons),
				quality = new Map(
					polygons.map((q) => [
						q.id,
						quadQuality(q.ring.map((v) => required(positions.get(v), 'positions.get(v)')))
					])
				);
			const sum = [...quality.values()].reduce((s, q) => s + q.area, 0),
				sourceArea = area(f.ring.map((id) => required(initial.get(id), 'initial.get(id)')));
			if (Math.abs(sum - sourceArea) > 1e-9 * Math.max(1, sourceArea))
				throw new InvariantError('coverage', [f.id]);
			return { root: f.id, topology, geometry: { positions, quality }, provenance };
		}
	}
	throw new InvariantError('quality-unattainable', [f.id]);
}
export function compile(input: Intent): Model {
	const intent: Intent = structuredClone(input);
	validateIntent(intent);
	const chunks = new Map<string, Chunk>(),
		dependencies = new Map<string, string[]>();
	for (const f of [...intent.faces.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
		chunks.set(f.id, deriveChunk(intent, f));
		for (const v of new Set([...f.ring, ...(f.parts ?? []).flat()])) {
			if (!dependencies.has(v)) dependencies.set(v, []);
			required(dependencies.get(v), 'dependencies.get(v)').push(f.id);
		}
	}
	return { version: 1, intent, chunks, semantics: intent.semantics, dependencies };
}
/** Materialized global primal/dual view. Not called during a local transaction. */
export function topologyOf(model: Model) {
	return buildTopology(
		[...model.chunks.values()].flatMap((c) =>
			[...c.topology.faces.values()].map((f) => ({ id: f.id, ring: f.vertices, level: f.level }))
		)
	);
}
export function validateModel(model: Model) {
	validateIntent(model.intent);
	validateTopology(topologyOf(model));
	const positions = new Map<string, Vec>();
	for (const chunk of model.chunks.values()) {
		validateTopology(chunk.topology);
		for (const [id, p] of chunk.geometry.positions) {
			const old = positions.get(id);
			if (old && length(sub(old, p)) !== 0) throw new InvariantError('seam', [id]);
			positions.set(id, p);
		}
		for (const f of chunk.topology.faces.values())
			if (
				!acceptable(
					quadQuality(f.vertices.map((v) => required(positions.get(v), 'positions.get(v)'))),
					model.intent.limits
				)
			)
				throw new InvariantError('quality', [f.id]);
		for (const node of chunk.provenance.values()) {
			if (node.parent === null && node.id !== chunk.root)
				throw new InvariantError('orphan-provenance', [node.id]);
			for (const c of node.children)
				if (chunk.provenance.get(c)?.parent !== node.id)
					throw new InvariantError('provenance', [c]);
		}
	}
}

export function validateParts(intent: Intent, f: SourceFace) {
	const directed = new Set<string>();
	let sum = 0;
	for (const ring of f.parts ?? []) {
		if (
			ring.length < 3 ||
			new Set(ring).size !== ring.length ||
			ring.some((v) => !intent.positions.has(v))
		)
			throw new InvariantError('invalid-parts', [f.id]);
		try {
			validateRing(ring.map((v) => required(intent.positions.get(v), 'intent.positions.get(v)')));
		} catch {
			throw new InvariantError('invalid-parts', [f.id]);
		}
		sum += area(ring.map((v) => required(intent.positions.get(v), 'intent.positions.get(v)')));
		ring.forEach((a, i) => {
			const key = JSON.stringify([a, ring[(i + 1) % ring.length]]);
			if (directed.has(key)) throw new InvariantError('parts-boundary', [f.id]);
			directed.add(key);
		});
	}
	const boundary = new Set(
		[...directed].filter((k) => {
			const [a, b] = JSON.parse(k);
			return !directed.has(JSON.stringify([b, a]));
		})
	);
	if (
		boundary.size !== f.ring.length ||
		f.ring.some((a, i) => !boundary.has(JSON.stringify([a, f.ring[(i + 1) % f.ring.length]])))
	)
		throw new InvariantError('parts-boundary', [f.id]);
	const total = area(
		f.ring.map((v) => required(intent.positions.get(v), 'intent.positions.get(v)'))
	);
	if (Math.abs(sum - total) > 1e-9 * Math.max(1, total))
		throw new InvariantError('coverage', [f.id]);
}
export function quadsOf(model: Model) {
	return [...model.chunks]
		.sort(([a], [b]) => (a < b ? -1 : 1))
		.flatMap(([chunk, c]) =>
			[...c.topology.faces.values()]
				.sort((a, b) => (a.id < b.id ? -1 : 1))
				.map((f) => ({ id: f.id, chunk, vertices: f.vertices }))
		);
}
export function positionsOf(model: Model) {
	const result = new Map<string, Vec>();
	for (const c of model.chunks.values())
		for (const [id, p] of c.geometry.positions) {
			const old = result.get(id);
			if (old && length(sub(old, p)) !== 0) throw new InvariantError('seam', [id]);
			result.set(id, p);
		}
	return result;
}
export function interiorOf(model: Model, chunk: string) {
	const ring = required(model.intent.faces.get(chunk), 'model.intent.faces.get(chunk)').ring,
		boundary = new Set([
			...ring,
			...ring.map((a, i) => 'mid:' + edgeId(a, ring[(i + 1) % ring.length]))
		]);
	return [...required(model.chunks.get(chunk), 'model.chunks.get(chunk)').geometry.positions.keys()]
		.filter((v) => !boundary.has(v))
		.sort();
}
export function qualityOf(model: Model) {
	const qs = [...model.chunks.values()].flatMap((c) => [...c.geometry.quality.values()]);
	return {
		minAngle: Math.min(...qs.map((q) => q.minAngle)),
		minJacobian: Math.min(...qs.map((q) => q.minJacobian)),
		minArea: Math.min(...qs.map((q) => q.area)),
		maxAspect: Math.max(...qs.map((q) => q.aspect))
	};
}
