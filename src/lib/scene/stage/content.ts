import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh } from 'three/webgpu';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineSegments2 } from 'three/addons/lines/webgpu/LineSegments2.js';
import type { Bounds3 } from '../../core/geometry';
import type { Drawable } from '../surface';
import { shapeArrays } from './geometry';
import { boundaryGeometry, edgeGeometry, explicitStroke, type strokeMaterials } from './edges';
import { projectGround } from './ground';
import { fillMaterial } from './material';
import type { drawingPalette } from './tone';

export function hasSameGeometry(
	parts: readonly { drawable: Drawable }[],
	drawables: readonly Drawable[]
) {
	return (
		parts.length === drawables.length &&
		parts.every(({ drawable }, index) => sameGeometry(drawable, drawables[index]))
	);
}

function sameGeometry(a: Drawable, b: Drawable) {
	return (
		a.id === b.id &&
		a.shape === b.shape &&
		a.boundaryStroke === b.boundaryStroke &&
		a.strokeSegments === b.strokeSegments &&
		a.terrainField === b.terrainField &&
		(a.finish === 'line') === (b.finish === 'line')
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
			? [{ geometry: stroke, material: explicitStroke() }]
			: [
					{ geometry: stroke, material: strokes.crease },
					{ geometry: stroke, material: strokes.outer }
				];
	// Draw explicit strokes after translucent faces.
	const layerOrder = drawable.strokeSegments ? 4 : 0;
	const lines = strokesToDraw.map(({ geometry, material }, index) =>
		projectStroke(geometry, material, layerOrder ? layerOrder + 1 : 2 + index)
	);
	const fill = landscape ? indexed : indexed.toNonIndexed();
	if (fill !== indexed) indexed.dispose();
	fill.computeVertexNormals();
	fill.computeBoundingBox();
	const { material, terrain, flat, heightScale, stretch, pivot, atlas } = fillMaterial(
		palette,
		drawable.terrainField
	);
	const mesh = new Mesh(fill, material);
	mesh.renderOrder = layerOrder;
	return { drawable, mesh, lines, grid, terrain, flat, heightScale, stretch, pivot, atlas };
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

type Part = ReturnType<typeof project>;

function disposePart({ drawable, mesh, lines, grid, atlas }: Part) {
	mesh.geometry.dispose();
	mesh.material.dispose();
	atlas?.dispose();
	if (grid || drawable.strokeSegments) for (const line of lines) line.material.dispose();
	for (const geometry of new Set(lines.map((line) => line.geometry))) geometry.dispose();
}

function toBounds(box: Box3): Bounds3 {
	return box.isEmpty()
		? { min: [0, 0, 0], max: [0, 0, 0] }
		: { min: box.min.toArray(), max: box.max.toArray() };
}

export function createContent(
	strokes: ReturnType<typeof strokeMaterials>,
	palette: ReturnType<typeof drawingPalette>,
	landscape: boolean
) {
	const group = new Group();
	let parts: Part[] = [];
	let ground: ReturnType<typeof projectGround> | undefined;
	const box = new Box3();
	const footprint = new Box3();

	function deleteGround() {
		if (!ground) return;
		group.remove(ground.shadow, ground.outline);
		ground.shadow.geometry.dispose();
		ground.shadow.material.dispose();
		ground.outline.geometry.dispose();
		ground = undefined;
	}

	function fitGround() {
		const nextBox = new Box3();
		const nextFootprint = new Box3();
		const boxes = parts.flatMap(({ mesh }) => mesh.geometry.boundingBox ?? []);
		for (const bounds of boxes) nextBox.union(bounds);
		for (const bounds of boxes) {
			if (bounds.min.z === nextBox.min.z) nextFootprint.union(bounds);
		}
		if (box.equals(nextBox) && footprint.equals(nextFootprint)) return;
		box.copy(nextBox);
		footprint.copy(nextFootprint);
		deleteGround();
		if (footprint.isEmpty()) return;
		ground = projectGround(toBounds(box), toBounds(footprint), strokes.ground);
		ground.outline.visible = !landscape;
		group.add(ground.shadow, ground.outline);
	}

	return {
		group,
		get parts() {
			return parts;
		},
		get ground() {
			return ground;
		},
		get clippingBounds(): Bounds3 {
			const visible = new Box3();
			for (const { drawable, mesh } of parts) {
				const bounds = mesh.geometry.boundingBox;
				if (drawable.visible === false || !bounds || bounds.isEmpty()) continue;
				const { scale, pivot, pinFillBelow } = drawable.vertical ?? { scale: 1, pivot: 0 };
				const next = bounds.clone();
				next.min.z +=
					(pinFillBelow ? Math.max(0, next.min.z - pivot) : next.min.z - pivot) * (scale - 1);
				next.max.z += Math.max(0, next.max.z - pivot) * (scale - 1);
				visible.union(next);
			}
			return toBounds(visible);
		},
		get bounds(): Bounds3 {
			const visible = new Box3();
			for (const { drawable, mesh } of parts) {
				if (drawable.visible !== false && mesh.geometry.boundingBox)
					visible.union(mesh.geometry.boundingBox);
			}
			return toBounds(visible.isEmpty() ? box : visible);
		},
		style(drawables: readonly Drawable[]) {
			if (!hasSameGeometry(parts, drawables))
				throw new Error('Presentation must retain drawable geometry');
			parts.forEach((part, index) => (part.drawable = drawables[index]));
		},
		show(drawables: readonly Drawable[]) {
			if (hasSameGeometry(parts, drawables)) {
				parts.forEach((part, index) => (part.drawable = drawables[index]));
				return 0;
			}
			const available = new Map<string, Part[]>();
			for (const part of parts) {
				const matches = available.get(part.drawable.id) ?? [];
				matches.push(part);
				available.set(part.drawable.id, matches);
				group.remove(part.mesh, ...part.lines);
			}
			let builds = 0;
			parts = drawables.map((drawable) => {
				const matches = available.get(drawable.id) ?? [];
				const index = matches.findIndex((part) => sameGeometry(part.drawable, drawable));
				if (index >= 0) {
					const [part] = matches.splice(index, 1);
					part.drawable = drawable;
					return part;
				}
				builds++;
				return project(drawable, strokes, palette, landscape);
			});
			for (const staleParts of available.values()) for (const part of staleParts) disposePart(part);
			for (const { mesh, lines } of parts) group.add(mesh, ...lines);
			fitGround();
			return builds;
		},
		delete() {
			deleteGround();
			for (const part of parts) disposePart(part);
			group.clear();
			parts = [];
		}
	};
}
