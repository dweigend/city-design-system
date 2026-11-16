import { edgeId, InvariantError, type SourceFace, type Topology, type HalfEdge } from './types';
/** Exterior is represented by null twins, not an artificial exterior face. */
export function buildTopology(input: readonly SourceFace[]): Topology {
	const faces = new Map<
			string,
			{ id: string; edge: string; vertices: readonly string[]; level: number }
		>(),
		edges = new Map<string, HalfEdge>(),
		incident = new Map<string, string[]>(),
		dual = new Map<string, string[]>(),
		pairs = new Map<string, string>();
	for (const f of [...input].sort((a, b) => (a.id < b.id ? -1 : 1))) {
		if (faces.has(f.id) || f.ring.length < 3 || new Set(f.ring).size !== f.ring.length)
			throw new InvariantError('invalid-face', [f.id]);
		const ids = f.ring.map((_, i) => JSON.stringify([f.id, i]));
		faces.set(f.id, { id: f.id, edge: ids[0], vertices: [...f.ring], level: f.level });
		dual.set(f.id, []);
		f.ring.forEach((v, i) => {
			const id = ids[i],
				dest = f.ring[(i + 1) % ids.length],
				key = edgeId(v, dest),
				other = pairs.get(key);
			const h: HalfEdge = {
				id,
				origin: v,
				face: f.id,
				next: ids[(i + 1) % ids.length],
				prev: ids[(i + ids.length - 1) % ids.length],
				twin: other ?? null
			};
			if (other) {
				const t = edges.get(other)!;
				if (t.twin || t.origin !== dest || faces.get(t.face)!.level !== f.level)
					throw new InvariantError('nonmanifold-edge', [v, dest]);
				t.twin = id;
				dual.get(f.id)!.push(t.face);
				dual.get(t.face)!.push(f.id);
			} else pairs.set(key, id);
			edges.set(id, h);
			if (!incident.has(v)) incident.set(v, []);
			incident.get(v)!.push(f.id);
		});
	}
	// A vertex star must be a single disk or half-disk: rejects bow ties.
	for (const [v, fs] of incident) {
		const remaining = new Set(fs),
			pending = [fs[0]];
		while (pending.length) {
			const f = pending.pop()!;
			if (!remaining.delete(f)) continue;
			const face = faces.get(f)!,
				i = face.vertices.indexOf(v);
			for (const j of [i, (i + face.vertices.length - 1) % face.vertices.length]) {
				const t = edges.get(JSON.stringify([f, j]))!.twin;
				if (t) pending.push(edges.get(t)!.face);
			}
		}
		if (remaining.size) throw new InvariantError('nonmanifold-vertex', [v]);
	}
	return { faces, edges, incident, dual };
}
export function validateTopology(t: Topology) {
	for (const h of t.edges.values()) {
		const next = t.edges.get(h.next),
			prev = t.edges.get(h.prev),
			twin = h.twin ? t.edges.get(h.twin) : null;
		if (
			!next ||
			!prev ||
			next.prev !== h.id ||
			prev.next !== h.id ||
			next.face !== h.face ||
			prev.face !== h.face
		)
			throw new InvariantError('broken-cycle', [h.id]);
		if (
			h.twin &&
			(!twin ||
				twin.twin !== h.id ||
				twin.origin !== next.origin ||
				t.edges.get(twin.next)?.origin !== h.origin)
		)
			throw new InvariantError('broken-twin', [h.id]);
	}
	const rebuilt = buildTopology(
		[...t.faces.values()].map((f) => ({ id: f.id, ring: f.vertices, level: f.level }))
	);
	if (
		rebuilt.edges.size !== t.edges.size ||
		rebuilt.incident.size !== t.incident.size ||
		rebuilt.dual.size !== t.dual.size
	)
		throw new InvariantError('topology-size');
	for (const [id, h] of rebuilt.edges)
		if (JSON.stringify(h) !== JSON.stringify(t.edges.get(id)))
			throw new InvariantError('topology-edge', [id]);
	for (const [v, fs] of rebuilt.incident)
		if (JSON.stringify(fs) !== JSON.stringify(t.incident.get(v)))
			throw new InvariantError('broken-incidence', [v]);
	for (const [f, ns] of rebuilt.dual)
		if (JSON.stringify(ns) !== JSON.stringify(t.dual.get(f)))
			throw new InvariantError('broken-dual', [f]);
}
