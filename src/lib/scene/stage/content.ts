import {
	Box3,
	BufferGeometry,
	EdgesGeometry,
	Float32BufferAttribute,
	Group,
	Mesh,
	Vector3,
	type Line2NodeMaterial
} from 'three/webgpu';
import { LineSegments2 } from 'three/addons/lines/webgpu/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import type { Bounds3 } from '../../core/geometry';
import type { Drawable } from '../surface';
import { shapeArrays } from './geometry';
import { fillMaterial } from './material';

function project(drawable: Drawable, ink: Line2NodeMaterial, bounds: Box3) {
	const { positions, indices } = shapeArrays(drawable.shape);
	const indexed = new BufferGeometry();
	indexed.setAttribute('position', new Float32BufferAttribute(positions, 3));
	indexed.setIndex([...indices]);
	const edges = new EdgesGeometry(indexed);
	const stroke = new LineSegmentsGeometry().setPositions(
		edges.attributes.position.array as Float32Array
	);
	edges.dispose();
	const line = new LineSegments2(stroke, ink);
	line.renderOrder = 1;
	line.visible = stroke.instanceCount > 0;
	const fill = indexed.toNonIndexed();
	indexed.dispose();
	fill.computeVertexNormals();
	const { material, shade } = fillMaterial(drawable.finish);
	const mesh = new Mesh(fill, material);
	const point = new Vector3();
	for (let i = 0; i < fill.attributes.position.count; i += 1)
		bounds.expandByPoint(point.fromBufferAttribute(fill.attributes.position, i));
	return { drawable, mesh, line, shade };
}

export function projectContent(drawables: readonly Drawable[], ink: Line2NodeMaterial) {
	const box = new Box3();
	const group = new Group();
	const parts = drawables.map((drawable) => project(drawable, ink, box));
	for (const { mesh, line } of parts) group.add(mesh, line);
	const bounds: Bounds3 = box.isEmpty()
		? { min: [0, 0, 0], max: [0, 0, 0] }
		: { min: box.min.toArray(), max: box.max.toArray() };
	return {
		parts,
		group,
		bounds,
		delete() {
			for (const { mesh, line } of parts) {
				mesh.geometry.dispose();
				mesh.material.dispose();
				line.geometry.dispose();
			}
		}
	};
}
