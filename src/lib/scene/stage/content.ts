import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh } from 'three/webgpu';
import { LineSegments2 } from 'three/addons/lines/webgpu/LineSegments2.js';
import type { Bounds3 } from '../../core/geometry';
import type { Drawable } from '../surface';
import { shapeArrays } from './geometry';
import { edgeGeometry, type strokeMaterials } from './edges';
import { projectGround } from './ground';
import { fillMaterial, type drawingPalette } from './material';

export function hasSameGeometry(
	parts: readonly { drawable: Drawable }[],
	drawables: readonly Drawable[]
) {
	return (
		parts.length === drawables.length &&
		parts.every(
			({ drawable }, index) =>
				drawable.id === drawables[index].id && drawable.shape === drawables[index].shape
		)
	);
}

function project(
	drawable: Drawable,
	strokes: ReturnType<typeof strokeMaterials>,
	palette: ReturnType<typeof drawingPalette>
) {
	const { positions, indices } = shapeArrays(drawable.shape);
	const indexed = new BufferGeometry();
	indexed.setAttribute('position', new Float32BufferAttribute(positions, 3));
	indexed.setIndex([...indices]);
	const stroke = edgeGeometry(positions, indices);
	const lines = [strokes.crease, strokes.outer].map((material, index) => {
		const line = new LineSegments2(stroke, material);
		line.renderOrder = 2 + index;
		line.visible = stroke.instanceCount > 0;
		return line;
	});
	const fill = indexed.toNonIndexed();
	indexed.dispose();
	fill.computeVertexNormals();
	fill.computeBoundingBox();
	const mesh = new Mesh(fill, fillMaterial(palette));
	return { drawable, mesh, stroke, lines };
}

export function projectContent(
	drawables: readonly Drawable[],
	strokes: ReturnType<typeof strokeMaterials>,
	palette: ReturnType<typeof drawingPalette>
) {
	const box = new Box3();
	const group = new Group();
	const parts = drawables.map((drawable) => project(drawable, strokes, palette));
	for (const { mesh, lines } of parts) {
		group.add(mesh, ...lines);
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
		: projectGround(
				bounds,
				{ min: footprint.min.toArray(), max: footprint.max.toArray() },
				strokes.ground
			);
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
			for (const { mesh, stroke } of parts) {
				mesh.geometry.dispose();
				mesh.material.dispose();
				stroke.dispose();
			}
		}
	};
}
