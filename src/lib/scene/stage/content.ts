import {
	Box3,
	BufferGeometry,
	EdgesGeometry,
	Float32BufferAttribute,
	Group,
	Mesh,
	type Line2NodeMaterial
} from 'three/webgpu';
import { LineSegments2 } from 'three/addons/lines/webgpu/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import type { Bounds3 } from '../../core/geometry';
import type { Drawable } from '../surface';
import { shapeArrays } from './geometry';
import { projectGround } from './ground';
import { fillMaterial, type drawingPalette } from './material';

function project(
	drawable: Drawable,
	ink: Line2NodeMaterial,
	palette: ReturnType<typeof drawingPalette>
) {
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
	line.renderOrder = 2;
	line.visible = stroke.instanceCount > 0;
	const fill = indexed.toNonIndexed();
	indexed.dispose();
	fill.computeVertexNormals();
	fill.computeBoundingBox();
	const mesh = new Mesh(fill, fillMaterial(drawable.finish, palette));
	return { drawable, mesh, line };
}

export function projectContent(
	drawables: readonly Drawable[],
	ink: Line2NodeMaterial,
	pencil: Line2NodeMaterial,
	palette: ReturnType<typeof drawingPalette>
) {
	const box = new Box3();
	const group = new Group();
	const parts = drawables.map((drawable) => project(drawable, ink, palette));
	for (const { mesh, line } of parts) {
		group.add(mesh, line);
		if (mesh.geometry.boundingBox) box.union(mesh.geometry.boundingBox);
	}

	const footprint = new Box3();
	for (const { mesh } of parts) {
		const part = mesh.geometry.boundingBox;
		if (part?.min.z === box.min.z) footprint.union(part);
	}
	const bounds: Bounds3 = box.isEmpty()
		? { min: [0, 0, 0], max: [0, 0, 0] }
		: { min: box.min.toArray(), max: box.max.toArray() };
	const ground = footprint.isEmpty()
		? undefined
		: projectGround({ min: footprint.min.toArray(), max: footprint.max.toArray() }, pencil);
	if (ground) group.add(ground.shadow, ground.outline);
	return {
		parts,
		group,
		bounds,
		ground,
		delete() {
			ground?.shadow.geometry.dispose();
			ground?.shadow.material.dispose();
			ground?.outline.geometry.dispose();
			for (const { mesh, line } of parts) {
				mesh.geometry.dispose();
				mesh.material.dispose();
				line.geometry.dispose();
			}
		}
	};
}
