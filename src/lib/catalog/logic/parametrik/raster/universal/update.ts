import { assemble } from '../../eckraster/topology';
import type { Point2 } from '../../vocab';
import { quality } from './index';
import type { UniversalPatch } from './types';
/** Coordinate-only transaction. Fixed vertices cannot move; invalid proposals are rejected.
 * Evaluates only incident faces; derived dual polygons are currently rebuilt in O(V+F).
 */
export function updatePatch(
	patch: UniversalPatch,
	moved: ReadonlyMap<string, Point2>
): UniversalPatch {
	const vertices = new Map(patch.vertices.map((v) => [v.id, v]));
	const points = new Map(patch.vertices.map((v) => [v.id, [...v.point] as Point2]));
	const affected = new Set<string>();
	for (const [id, p] of moved) {
		const v = vertices.get(id);
		if (!v) throw new Error(`Unknown vertex: ${id}`);
		if (patch.origins.get(id)!.fixed) throw new Error(`Fixed vertex: ${id}`);
		if (!p.every(Number.isFinite)) throw new Error('Coordinates must be finite');
		points.set(id, [...p]);
		v.faces.forEach((f) => affected.add(f));
	}
	const polygons = patch.faces.map((f) => ({ id: f.id, vertices: [...f.vertices] }));
	const local = quality(
		polygons.filter((f) => affected.has(f.id)).map((f) => f.vertices.map((id) => points.get(id)!))
	);
	if (
		affected.size &&
		(local.minAngle < Math.min(5, patch.quality.minAngle) - 1e-8 ||
			local.minArea < Math.min(0.01, patch.quality.minArea) - 1e-8)
	)
		throw new Error('Update violates quad quality');
	const next = assemble(patch.seed, points, polygons);
	for (const c of next.cells) c.level = patch.origins.get(c.id)!.level;
	return {
		...next,
		origins: new Map(
			[...patch.origins].map(([id, o]) => [
				id,
				{ ...o, cells: [...o.cells], edge: o.edge ? [...o.edge] : undefined }
			])
		),
		quality: quality(polygons.map((f) => f.vertices.map((id) => points.get(id)!)))
	};
}
