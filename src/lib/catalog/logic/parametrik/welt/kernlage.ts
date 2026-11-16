import { required } from '../../required';
/** Block-by-block derivation; rejections and fallbacks stay visible in the quality record. */
import { assemble } from '../eckraster/topology';
import {
	area,
	compile,
	defaultLimits,
	emptyMeaning,
	interiorOf,
	InvariantError,
	positionsOf,
	quadsOf,
	qualityOf,
	relax,
	type Intent,
	type Limits,
	type SourceFace,
	type Vec
} from '../raster/universal/kern';
import { ausPatch, lage, type Lage, type LageParams } from './lage';
import { netz, type Netz } from './netze';
export const WELT_GRENZEN: Limits = {
	minAngle: 10,
	minJacobian: 0.17,
	minArea: 0.25,
	maxAspect: 8
};
export function absicht(
	n: Netz,
	seed: number,
	limits: Limits
): { intent: Intent; haengend: number } {
	const positions = new Map<string, Vec>(),
		weld = new Map<string, string>(),
		groups = new Map<string, string[][]>();
	for (const c of [...n.grid.cells].sort((a, b) => (a.id < b.id ? -1 : 1))) {
		let ring = c.polygon.map((p, i) => {
			const key = p.map((v) => Math.round(v * 1e4)).join(',');
			let id = weld.get(key);
			if (!id) {
				id = `v:${c.id}:${i}`;
				weld.set(key, id);
				positions.set(id, p);
			}
			return id;
		});
		ring = ring.filter((id, i) => id !== ring[(i + ring.length - 1) % ring.length]);
		if (ring.length < 3) continue;
		if (area(ring.map((v) => required(positions.get(v), 'positions.get(v)'))) < 0) ring.reverse();
		const id = c.id.split('/')[0];
		if (!groups.has(id)) groups.set(id, []);
		required(groups.get(id), 'groups.get(id)').push(ring);
	}

	// Uniform search index. The segment rectangle is expanded by the snap tolerance.
	const lengths = [...groups.values()].flatMap((parts) =>
		parts.flatMap((ring) =>
			ring.map((a, i) => {
				const A = required(positions.get(a), 'positions.get(a)'),
					B = required(
						positions.get(ring[(i + 1) % ring.length]),
						'positions.get(ring[(i + 1) % ring.length])'
					);
				return Math.hypot(B[0] - A[0], B[1] - A[1]);
			})
		)
	);
	const size = lengths.reduce((s, l) => s + l, 0) / Math.max(1, lengths.length) || 1;
	const buckets = new Map<string, [string, Vec][]>(),
		rank = new Map([...positions.keys()].map((id, i) => [id, i]));
	for (const [id, q] of positions) {
		const key = `${Math.floor(q[0] / size)}:${Math.floor(q[1] / size)}`;
		if (!buckets.has(key)) buckets.set(key, []);
		required(buckets.get(key), 'buckets.get(key)').push([id, q]);
	}
	let haengend = 0;
	const faces = new Map<string, SourceFace>();
	for (const [id, parts] of groups) {
		const expanded = parts.map((ring) =>
			ring.flatMap((a, i) => {
				const b = ring[(i + 1) % ring.length],
					A = required(positions.get(a), 'positions.get(a)'),
					B = required(positions.get(b), 'positions.get(b)'),
					dx = B[0] - A[0],
					dy = B[1] - A[1],
					l2 = dx * dx + dy * dy;
				const hits: { v: string; t: number }[] = [];
				const margin = 1e-6 * Math.sqrt(l2),
					candidates: [string, Vec][] = [];
				for (
					let x = Math.floor((Math.min(A[0], B[0]) - margin) / size);
					x <= Math.floor((Math.max(A[0], B[0]) + margin) / size);
					x++
				)
					for (
						let y = Math.floor((Math.min(A[1], B[1]) - margin) / size);
						y <= Math.floor((Math.max(A[1], B[1]) + margin) / size);
						y++
					)
						candidates.push(...(buckets.get(`${x}:${y}`) ?? []));
				for (const [v, q] of candidates) {
					if (v === a || v === b) continue;
					const t = ((q[0] - A[0]) * dx + (q[1] - A[1]) * dy) / l2;
					if (
						t > 1e-7 &&
						t < 1 - 1e-7 &&
						Math.abs(dx * (q[1] - A[1]) - dy * (q[0] - A[0])) <= 1e-6 * l2
					)
						hits.push({ v, t });
				}
				haengend += hits.length;
				return [
					a,
					...hits
						.sort(
							(a, b) =>
								a.t - b.t ||
								required(rank.get(a.v), 'rank.get(a.v)') - required(rank.get(b.v), 'rank.get(b.v)')
						)
						.map((h) => h.v)
				];
			})
		);
		const edges = new Map<string, [string, string]>();
		for (const ring of expanded)
			ring.forEach((a, i) => {
				const b = ring[(i + 1) % ring.length];
				edges.set(JSON.stringify([a, b]), [a, b]);
			});
		const boundary = [...edges.values()].filter(([a, b]) => !edges.has(JSON.stringify([b, a]))),
			next = new Map(boundary);
		if (next.size !== boundary.length) throw new InvariantError('parts-boundary', [id]);
		const first = [...next.keys()].sort()[0],
			ring = [first];
		let v = next.get(first);
		while (v && v !== first && ring.length <= boundary.length) {
			ring.push(v);
			v = next.get(v);
		}
		if (v !== first || ring.length !== boundary.length)
			throw new InvariantError('parts-boundary', [id]);
		faces.set(id, { id, ring, parts: expanded, level: 0 });
	}
	return {
		haengend,
		intent: {
			version: 1,
			seed: seed >>> 0,
			positions,
			faces,
			limits,
			fixed: new Set(),
			semantics: new Map([...faces.keys()].map((id) => [id, { ...emptyMeaning(), role: 'block' }]))
		}
	};
}
export function lageKern(p: LageParams): Lage {
	const n = netz(p),
		fehler: string[] = [];
	for (const [stufe, limits] of [WELT_GRENZEN, defaultLimits].entries()) {
		try {
			const { intent, haengend } = absicht(n, p.seed, limits);
			let model;
			try {
				model = compile(relax(intent, p.relax));
			} catch (e) {
				if (!(e instanceof InvariantError)) throw e;
				model = compile(intent);
				fehler.push('relax:' + e.code);
			}
			const patch = assemble(
					p.seed >>> 0,
					new Map([...positionsOf(model)].map(([id, p]) => [id, [p[0], p[1]]])),
					quadsOf(model).map((q) => ({ id: q.id, vertices: [...q.vertices] }))
				),
				rand = new Set(patch.vertices.filter((v) => v.boundary).map((v) => v.id));
			const groups = new Map(
				[...model.chunks.keys()].map((id) => [
					id,
					interiorOf(model, id).filter((v) => !rand.has(v))
				])
			);
			const q = qualityOf(model);
			return {
				...ausPatch(
					patch,
					groups,
					p.seed,
					{ ...q, js: q.minJacobian, stufe: stufe as 0 | 1, haengend, fehler },
					new Map(patch.cells.map((c) => [c.id, c.area]))
				),
				kern: { model },
				feldRueckfall: n.feldRueckfall
			};
		} catch (e) {
			if (!(e instanceof InvariantError)) throw e;
			fehler.push(e.code);
		}
	}
	const alt = lage(p);
	return { ...alt, guete: { ...alt.guete, stufe: 2, haengend: 0, fehler } };
}
