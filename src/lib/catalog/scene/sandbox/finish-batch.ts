import {
	Box3,
	BufferGeometry,
	Float32BufferAttribute,
	Material,
	Mesh,
	Vector3
} from 'three/webgpu';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ColorToken, FinishId, Primitive } from '../../logic/parametrik/types';
import { build } from '../primitive-geometry';

export type Surface = Exclude<Primitive, { kind: 'polyline' }> & { finish: FinishId };

/** Only triangles carry a surface. Drafting strokes keep their line treatment. */
export function hasFinish(part: Primitive): part is Surface {
	return part.finish !== undefined && part.kind !== 'polyline';
}

// Use normalized face projections on every solid, including procedural meshes without a UV chart.
function surfaceGeometry(part: Surface) {
	const built = build(part, true);
	const source = built.geometry;
	const g = source.index ? source.toNonIndexed() : source;
	if (source !== g) source.dispose();
	chartSurface(g);
	g.rotateY(built.rotation);
	g.translate(...built.position.toArray());
	return g;
}

function chartSurface(g: BufferGeometry) {
	g.computeBoundingBox();
	const bounds = g.boundingBox ?? new Box3();
	const size = bounds.getSize(new Vector3());
	const pos = g.getAttribute('position'),
		normal = g.getAttribute('normal');
	const uv = [];
	const chart = new Float32Array(pos.count * 4);
	for (let i = 0; i < pos.count; i++) {
		const x = (pos.getX(i) - bounds.min.x) / (size.x || 1);
		const y = (pos.getY(i) - bounds.min.y) / (size.y || 1);
		const z = (pos.getZ(i) - bounds.min.z) / (size.z || 1);
		chart.set(
			[pos.getX(i) - bounds.min.x, pos.getY(i) - bounds.min.y, pos.getZ(i) - bounds.min.z, y],
			4 * i
		);
		const side = Math.abs(normal.getX(i)) > Math.abs(normal.getZ(i));
		const top =
			Math.abs(normal.getY(i)) >= Math.max(Math.abs(normal.getX(i)), Math.abs(normal.getZ(i)));
		uv.push(top || !side ? x : z, top ? z : y);
	}
	g.setAttribute('finishChart', new Float32BufferAttribute(chart, 4));
	g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
}

/** Batches generated triangles by their assigned material. Caller owns returned geometry. */
export function finishedMeshes(
	parts: readonly Surface[],
	material: (id: FinishId, token: ColorToken) => Material
) {
	const groups = new Map<Material, BufferGeometry[]>();
	for (const part of parts) {
		const face = material(part.finish, part.token);
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
