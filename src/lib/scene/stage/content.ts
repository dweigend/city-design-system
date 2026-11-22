import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh } from 'three/webgpu';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineSegments2 } from 'three/addons/lines/webgpu/LineSegments2.js';
import type { Bounds3 } from '../../core/geometry';
import type { Drawable } from '../surface';
import { shapeArrays } from './geometry';
import { boundaryGeometry, edgeGeometry, type strokeMaterials } from './edges';
import { projectGround } from './ground';
import { fillMaterial } from './material';
import type { drawingPalette } from './tone';

export function hasSameGeometry(
	parts: readonly { drawable: Drawable }[],
	drawables: readonly Drawable[]
) {
	return (
		parts.length === drawables.length &&
		parts.every(
			({ drawable }, index) =>
				drawable.id === drawables[index].id &&
				drawable.shape === drawables[index].shape &&
				drawable.boundaryStroke === drawables[index].boundaryStroke &&
				drawable.strokeSegments === drawables[index].strokeSegments &&
				(drawable.finish === 'line') === (drawables[index].finish === 'line')
		)
	);
}

function project(
	drawable: Drawable,
	strokes: ReturnType<typeof strokeMaterials>,
	palette: ReturnType<typeof drawingPalette>,
	landscape: boolean
) {
	const { positions, indices } = shapeArrays(drawable.shape);
	const indexed = new BufferGeometry();
	indexed.setAttribute('position', new Float32BufferAttribute(positions, 3));
	indexed.setIndex([...indices]);
	const grid = landscape && drawable.finish === 'line';
	const stroke = drawable.strokeSegments
		? new LineSegmentsGeometry().setPositions([...drawable.strokeSegments])
		: grid
			? boundaryGeometry(positions, indices, true)
			: landscape
				? boundaryGeometry(positions, drawable.boundaryStroke ? indices : [])
				: edgeGeometry(positions, indices);
	const strokesToDraw = grid
		? [
				{ geometry: stroke, material: strokes.grid.clone() },
				{ geometry: boundaryGeometry(positions, indices), material: strokes.gridBoundary.clone() }
			]
		: drawable.strokeSegments
			? [{ geometry: stroke, material: strokes.explicit }]
			: [
					{ geometry: stroke, material: strokes.crease },
					{ geometry: stroke, material: strokes.outer }
				];
	// Explicit outlines sit over the hull fill, which tints the draped plan below it.
	const hullOrder = drawable.strokeSegments ? 4 : 0;
	const lines = strokesToDraw.map(({ geometry, material }, index) =>
		projectStroke(geometry, material, hullOrder ? hullOrder + 1 : 2 + index)
	);
	const fill = landscape && !drawable.strokeSegments ? indexed : indexed.toNonIndexed();
	if (fill !== indexed) indexed.dispose();
	fill.computeVertexNormals();
	fill.computeBoundingBox();
	const { material, terrain, flat, heightScale, atlas } = fillMaterial(
		palette,
		drawable.terrainField,
		drawable.strokeSegments !== undefined
	);
	const mesh = new Mesh(fill, material);
	mesh.renderOrder = hullOrder;
	return { drawable, mesh, lines, grid, terrain, flat, heightScale, atlas };
}

function projectStroke(
	geometry: LineSegmentsGeometry,
	material: ReturnType<typeof strokeMaterials>['grid'],
	order: number
) {
	const line = new LineSegments2(geometry, material);
	line.renderOrder = order;
	line.visible = geometry.instanceCount > 0;
	return line;
}

export function projectContent(
	drawables: readonly Drawable[],
	strokes: ReturnType<typeof strokeMaterials>,
	palette: ReturnType<typeof drawingPalette>,
	landscape: boolean
) {
	const box = new Box3();
	const group = new Group();
	const parts = drawables.map((drawable) => project(drawable, strokes, palette, landscape));
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
	if (ground) {
		ground.outline.visible = !landscape;
		group.add(ground.shadow, ground.outline);
	}
	return {
		parts,
		group,
		bounds,
		ground,
		delete() {
			ground?.shadow.geometry.dispose();
			ground?.shadow.material.dispose();
			ground?.outline.geometry.dispose();
			for (const { mesh, lines, grid, atlas } of parts) {
				mesh.geometry.dispose();
				mesh.material.dispose();
				atlas?.dispose();
				if (grid) for (const line of lines) line.material.dispose();
				for (const geometry of new Set(lines.map((line) => line.geometry))) geometry.dispose();
			}
		}
	};
}
