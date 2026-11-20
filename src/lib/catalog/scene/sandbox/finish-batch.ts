import { chartSurface } from '../surface-chart';
import { resolveFinish } from '../../logic/material/surface';
import type { createMaterialLibrary } from '../material-library';
import { BufferGeometry, type Material, Mesh } from 'three/webgpu';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FinishId, Primitive } from '../../logic/parametrik/types';
import { build } from '../primitive-geometry';

export type Surface = Exclude<Primitive, { kind: 'polyline' }> & { finish: FinishId };

/** Only triangles carry a surface. Drafting strokes keep their line treatment. */
export function hasFinish(part: Primitive): part is Surface {
	return part.finish !== undefined && part.kind !== 'polyline';
}

// Use continuous part-local projections on every solid, including procedural meshes without a UV chart.
function surfaceGeometry(part: Surface) {
	const built = build(part, true);
	const source = built.geometry;
	const g = source.index ? source.toNonIndexed() : source;
	if (source !== g) source.dispose();
	chartSurface(g, part.kind, built.rotation);
	g.rotateY(built.rotation);
	g.translate(...built.position.toArray());
	return g;
}

/** Batches generated triangles by their assigned material. Caller owns returned geometry. */
export function finishedMeshes(
	parts: readonly Surface[],
	library: ReturnType<typeof createMaterialLibrary>
) {
	const groups = new Map<Material, BufferGeometry[]>();
	const faces = new Map<string, Material>();
	for (const part of parts) {
		const key = [part.finish, part.token, part.ageTint ?? 0, part.colourRole].join('/');
		let face = faces.get(key);
		if (!face) {
			face = library.material(
				resolveFinish(part.finish, part.token, part.ageTint, part.colourRole)
			);
			faces.set(key, face);
		}
		const group = groups.get(face) ?? [];
		group.push(surfaceGeometry(part));
		groups.set(face, group);
	}
	return Array.from(groups, ([face, pieces]) => {
		if (pieces.length === 1) return new Mesh(pieces[0], face);
		const geometry = mergeGeometries(pieces);
		for (const piece of pieces) piece.dispose();
		return new Mesh(geometry, face);
	});
}
