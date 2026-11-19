import { EdgesGeometry, Float32BufferAttribute, type Color } from 'three/webgpu';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { flowToken } from '../../data/focus';
import type { Primitive } from '../../logic/parametrik/types';
import { build } from '../primitive-geometry';

const castingFamily = new Map<string, number>([
	['sphere', 2],
	['torus', 3],
	['ring', 3]
]);

function shellChart(part: Primitive, coords: ArrayLike<number>, token: Primitive['token']) {
	let cx = 0,
		cy = 0,
		cz = 0,
		dx = 1,
		dz = 0,
		radius = 1,
		half = 1;
	if (part.kind === 'capsule') {
		const { from: a, to: b } = part;
		cx = (a[0] + b[0]) / 2;
		cy = (a[2] + b[2]) / 2;
		cz = -(a[1] + b[1]) / 2;
		const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
		if (span) {
			dx = (b[0] - a[0]) / span;
			dz = (a[1] - b[1]) / span;
		}
		radius = part.radius;
		half = radius + span / 2;
	} else if ('position' in part) {
		[cx, cz, cy] = part.position;
		cz = -cz;
		if (part.kind === 'box') {
			cx += part.size[0] / 2;
			cz -= part.size[1] / 2;
			cy += part.size[2] / 2;
			radius = part.size[2] / 2;
			half = part.size[0] / 2;
		} else if ('radius' in part) {
			half = radius = part.radius;
		}
	}
	const family = castingFamily.get(part.kind) ?? 1;
	const finish = token === '--paper' ? 0 : family === 3 && token !== flowToken.energy ? 1 : family;
	const chart: number[] = [];
	for (let i = 0; i < coords.length; i += 3) {
		const x = coords[i] - cx,
			z = coords[i + 2] - cz;
		chart.push(
			(x * dx + z * dz) / half,
			(coords[i + 1] - cy) / radius,
			(z * dx - x * dz) / radius,
			finish
		);
	}
	return chart;
}

/** Bakes the dip coordinates of each casting before joining it to the ceramic draw call.
 * Only a shell with its own functional fitting inherits that fitting's pigment. */
export function ceramicBatch(
	parts: Primitive[],
	pigments: ReadonlyMap<string, Primitive>,
	tone: (p: Primitive) => Color
) {
	const edges: number[] = [];
	const pieces = parts.flatMap((part) => {
		if (part.kind === 'polyline') return [];
		const accent = pigments.get(part.id) ?? part;
		const color = tone(accent);
		const { geometry, position, rotation, edgeAngle } = build(part);
		geometry.rotateY(rotation);
		geometry.translate(position.x, position.y, position.z);
		geometry.deleteAttribute('uv');
		const vertices = geometry.getAttribute('position');
		const colors = new Float32Array(vertices.count * 3);
		for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
		geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
		const chart = shellChart(part, vertices.array, accent.token);
		geometry.setAttribute('kilnChart', new Float32BufferAttribute(chart, 4));
		if (!geometry.index) geometry.setIndex(Array.from({ length: vertices.count }, (_, i) => i));
		// Smooth castings have no crease edges. Their silhouette uses the indexed faces.
		if (part.edges !== false && !['capsule', 'sphere', 'torus'].includes(part.kind)) {
			const creases = new EdgesGeometry(geometry, edgeAngle);
			for (const v of creases.getAttribute('position').array) edges.push(v);
			creases.dispose();
		}
		return [geometry];
	});
	if (pieces.length < 2) return { geometry: pieces[0], edges };
	const geometry = mergeGeometries(pieces);
	for (const piece of pieces) piece.dispose();
	return { geometry, edges };
}
