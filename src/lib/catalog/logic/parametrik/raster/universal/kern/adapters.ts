import type { UniversalPatch } from '../types';
import { compile } from './model';
import { defaultLimits, emptyMeaning, type Limits, type Model } from './types';
/** Import a legacy conforming patch. Geometry is revalidated; no old quality promises inherited. */
export function fromPatch(p: UniversalPatch, limits: Limits = defaultLimits): Model {
	return compile({
		version: 1,
		seed: p.seed,
		limits,
		positions: new Map(p.vertices.map((v) => [v.id, v.point])),
		faces: new Map(
			p.faces.map((f) => [
				f.id,
				{ id: f.id, ring: f.vertices, level: p.origins.get(f.vertices[0])!.level }
			])
		),
		semantics: new Map(p.faces.map((f) => [f.id, emptyMeaning()])),
		fixed: new Set(p.vertices.filter((v) => p.origins.get(v.id)!.fixed).map((v) => v.id))
	});
}
