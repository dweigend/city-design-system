import type { SurfaceRecipe } from '../../logic/material/surface';
import {
	EdgesGeometry,
	Float32BufferAttribute,
	type BufferGeometry,
	Mesh,
	type Material
} from 'three/webgpu';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { flowToken } from '../../data/focus';
import type { Primitive } from '../../logic/parametrik/types';
import { build } from '../primitive-geometry';

const castingFamily = new Map<string, number>([
	['sphere', 2],
	['torus', 3],
	['ring', 3]
]);

function castingFrame(part: Primitive) {
	const frame = { cx: 0, cy: 0, cz: 0, dx: 1, dz: 0, radius: 1, half: 1 };
	if (part.kind === 'capsule') {
		const { from: a, to: b, radius } = part;
		const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
		return {
			cx: (a[0] + b[0]) / 2,
			cy: (a[2] + b[2]) / 2,
			cz: -(a[1] + b[1]) / 2,
			dx: span ? (b[0] - a[0]) / span : 1,
			dz: span ? (a[1] - b[1]) / span : 0,
			radius,
			half: radius + span / 2
		};
	}
	if (!('position' in part)) return frame;
	const [x, y, z] = part.position;
	if (part.kind === 'box') {
		const [w, d, h] = part.size;
		return { ...frame, cx: x + w / 2, cy: z + h / 2, cz: -y - d / 2, half: w / 2, radius: h / 2 };
	}
	const radius = 'radius' in part ? part.radius : 1;
	return { ...frame, cx: x, cy: z, cz: -y, half: radius, radius };
}

function shellChart(part: Primitive, coords: ArrayLike<number>) {
	const { cx, cy, cz, dx, dz, radius, half } = castingFrame(part);
	const chart: number[] = [];
	for (let i = 0; i < coords.length; i += 3) {
		const x = coords[i] - cx,
			z = coords[i + 2] - cz;
		chart.push((x * dx + z * dz) / half, (coords[i + 1] - cy) / radius, (z * dx - x * dz) / radius);
	}
	return chart;
}

function castingGeometry(part: Exclude<Primitive, { kind: 'polyline' }>, edges: number[]) {
	const { geometry, position, rotation, edgeAngle } = build(part);
	geometry.rotateY(rotation);
	geometry.translate(position.x, position.y, position.z);
	geometry.deleteAttribute('uv');
	const vertices = geometry.getAttribute('position');
	geometry.setAttribute(
		'kilnChart',
		new Float32BufferAttribute(shellChart(part, vertices.array), 3)
	);
	if (!geometry.index) geometry.setIndex(Array.from({ length: vertices.count }, (_, i) => i));
	// Smooth castings have no crease edges. Their silhouette uses the indexed faces.
	if (part.edges !== false && !['capsule', 'sphere', 'torus'].includes(part.kind)) {
		const creases = new EdgesGeometry(geometry, edgeAngle);
		for (const v of creases.getAttribute('position').array) edges.push(v);
		creases.dispose();
	}
	return geometry;
}

/** Bakes the dip coordinates of each casting before joining it to the ceramic draw call.
 * Only a shell with its own functional fitting inherits that fitting's pigment. */
export function ceramicBatch(
	parts: Primitive[],
	pigments: ReadonlyMap<string, Primitive>,
	materialFor: (slot: Extract<SurfaceRecipe, { kind: 'kiln' }>) => Material
) {
	const edges: number[] = [];
	const groups = new Map<Material, BufferGeometry[]>();
	for (const part of parts) {
		if (part.kind === 'polyline') continue;
		const token = (pigments.get(part.id) ?? part).token;
		const family = castingFamily.get(part.kind) ?? 1;
		const finish =
			token === '--paper' ? 0 : family === 3 && token !== flowToken.energy ? 1 : family;
		const material = materialFor({ kind: 'kiln', id: 'fired-slip', token, casting: finish });
		const geometry = castingGeometry(part, edges);
		const group = groups.get(material) ?? [];
		group.push(geometry);
		groups.set(material, group);
	}
	const meshes = Array.from(groups, ([material, pieces]) => {
		if (pieces.length === 1) return new Mesh(pieces[0], material);
		const geometry = mergeGeometries(pieces);
		for (const piece of pieces) piece.dispose();
		return new Mesh(geometry, material);
	});
	return { meshes, edges };
}
