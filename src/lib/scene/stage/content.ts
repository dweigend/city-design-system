import {
	Box3,
	BufferGeometry,
	Float32BufferAttribute,
	Group,
	Mesh,
	MeshBasicNodeMaterial,
	type Object3D,
	Raycaster,
	Vector3
} from 'three/webgpu';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineSegments2 } from 'three/addons/lines/webgpu/LineSegments2.js';
import type { Bounds3, Vec3 } from '../../core/geometry';
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
		a.creaseAngleRad === b.creaseAngleRad &&
		a.strokeSegments === b.strokeSegments &&
		a.terrainField === b.terrainField &&
		a.warp?.fill === b.warp?.fill &&
		a.warp?.stroke === b.warp?.stroke &&
		(a.finish === 'line') === (b.finish === 'line')
	);
}

/** Retained base positions and aligned offsets of one warped array. */
type WarpTarget = {
	array: Float32Array;
	base: Float32Array;
	offsets: Float32Array;
	stride: number;
};

function warpTarget(array: Float32Array, offsets: readonly number[], stride = 3): WarpTarget {
	return { array, base: array.slice(), offsets: Float32Array.from(offsets), stride };
}

/** Moves every warped point to base + amount × offset in place. */
function applyWarp(targets: readonly WarpTarget[], amount: number) {
	for (const { array, base, offsets, stride } of targets) {
		for (let point = 0; point < offsets.length / 2; point++) {
			const i = point * stride;
			array[i] = base[i] + amount * offsets[2 * point];
			array[i + 1] = base[i + 1] + amount * offsets[2 * point + 1];
		}
	}
}

/** Expands per-vertex offsets to the order of a non-indexed copy. */
function expandOffsets(offsets: readonly number[], indices: readonly number[]) {
	return indices.flatMap((index) => [offsets[2 * index], offsets[2 * index + 1]]);
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
			: landscape && drawable.creaseAngleRad === undefined
				? boundaryGeometry(positions, drawable.boundaryStroke ? indices : [])
				: edgeGeometry(positions, indices, drawable.creaseAngleRad);
	const explicit = drawable.strokeSegments
		? [explicitStroke(strokes.depth), explicitStroke(strokes.depth, true)]
		: [];
	const strokesToDraw = grid
		? [
				{ geometry: stroke, material: strokes.grid.clone() },
				{ geometry: boundaryGeometry(positions, indices), material: strokes.gridBoundary.clone() }
			]
		: drawable.strokeSegments
			? explicit.map(({ material }) => ({ geometry: stroke, material }))
			: [
					{ geometry: stroke, material: strokes.crease },
					{ geometry: stroke, material: strokes.outer }
				];
	// Draw explicit strokes after translucent faces, and ground shade between ground and bodies.
	const layerOrder = drawable.strokeSegments ? 4 : 0;
	const lines = strokesToDraw.map(({ geometry, material }, index) =>
		projectStroke(geometry, material, layerOrder ? layerOrder + 1 : 2 + index)
	);
	const fill = landscape ? indexed : indexed.toNonIndexed();
	if (fill !== indexed) indexed.dispose();
	fill.computeVertexNormals();
	fill.computeBoundingBox();
	const { material, terrain, flat, heightScale, hatch, faces, grain, atlas } = fillMaterial(
		palette,
		drawable.terrainField
	);
	const mesh = new Mesh(fill, material);
	mesh.renderOrder = drawable.finish === 'shadow' ? 1 : layerOrder;
	// The depth of a translucent body is laid after every opaque body, so a body behind it stays
	// visible through the tint while strokes behind it switch to their hidden pass.
	const veil = new Mesh(fill, new MeshBasicNodeMaterial({ colorWrite: false }));
	veil.renderOrder = 6;
	veil.visible = false;
	mesh.add(veil);
	const warp = drawable.warp;
	const warpTargets = warp
		? [
				warpTarget(
					fill.attributes.position.array as Float32Array,
					fill === indexed ? warp.fill : expandOffsets(warp.fill, indices)
				),
				...(warp.stroke && stroke instanceof LineSegmentsGeometry
					? [warpTarget(segmentArray(stroke), warp.stroke)]
					: [])
			]
		: [];
	return {
		drawable,
		mesh,
		veil,
		lines,
		recede: explicit.map(({ recede }) => recede),
		grid,
		terrain,
		flat,
		heightScale,
		hatch,
		faces,
		grain,
		atlas,
		warpTargets,
		warpAmount: 0
	};
}

function segmentArray(geometry: LineSegmentsGeometry) {
	const start = geometry.getAttribute('instanceStart') as unknown as {
		data: { array: Float32Array };
	};
	return start.data.array;
}

/** Moves a warped part to the drawable's amount, uploading only the changed arrays. */
export function warpPart(part: Part) {
	const amount = part.drawable.warp?.amount ?? 0;
	if (!part.warpTargets.length || amount === part.warpAmount) return;
	part.warpAmount = amount;
	applyWarp(part.warpTargets, amount);
	const fill = part.mesh.geometry;
	fill.attributes.position.needsUpdate = true;
	// Shading, culling and clipping read the warped faces, not the retained base.
	fill.computeVertexNormals();
	fill.computeBoundingBox();
	fill.computeBoundingSphere();
	for (const geometry of new Set(part.lines.map((line) => line.geometry))) {
		const start = geometry.getAttribute('instanceStart') as unknown as {
			data: { needsUpdate: boolean };
		};
		if (start) start.data.needsUpdate = true;
	}
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

export type Part = ReturnType<typeof project>;

const ray = new Raycaster();
const origin = new Vector3();

/** The nearest point where a line through `point` along `direction` meets one of the meshes as
 * displayed, with their current scale and warp, or undefined. */
export function rayHit(meshes: readonly Mesh[], point: Vec3, direction: Vec3) {
	ray.set(origin.fromArray(point), new Vector3(...direction).normalize());
	// Start the ray behind every mesh, so a point on the image plane can lie inside the scene.
	const reach = meshes.reduce((most, mesh) => {
		mesh.updateMatrixWorld();
		if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
		const { center, radius } = mesh.geometry.boundingSphere ?? { center: origin, radius: 0 };
		return most + origin.distanceTo(center) + 2 * mesh.matrixWorld.getMaxScaleOnAxis() * radius;
	}, 0);
	ray.ray.origin.addScaledVector(ray.ray.direction, -reach);
	const [first] = ray.intersectObjects([...meshes], false);
	return first?.point.toArray() as Vec3 | undefined;
}

function disposePart({ drawable, mesh, veil, lines, grid, atlas }: Part) {
	mesh.geometry.dispose();
	mesh.material.dispose();
	veil.material.dispose();
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
	const clipping = new Box3();
	const scratch = new Box3();

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
			const visible = clipping.makeEmpty();
			for (const { drawable, mesh } of parts) {
				const bounds = mesh.geometry.boundingBox;
				if (drawable.visible === false || !bounds || bounds.isEmpty()) continue;
				const scale = drawable.vertical?.scale ?? 1;
				const pivot = drawable.vertical?.pivot ?? 0;
				scratch.copy(bounds);
				scratch.min.z += (scratch.min.z - pivot) * (scale - 1);
				scratch.max.z += (scratch.max.z - pivot) * (scale - 1);
				visible.union(scratch);
			}
			return toBounds(visible);
		},
		/** The displayed terrain point on a view ray through `point`, if any. */
		hit: (point: Vec3, direction: Vec3) => {
			const ground = parts.filter(
				({ drawable: d, mesh }) => d.finish === 'terrain' && mesh.visible
			);
			return rayHit(
				ground.map(({ mesh }) => mesh),
				point,
				direction
			);
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
			}
			let builds = 0;
			const added: Part[] = [];
			parts = drawables.map((drawable) => {
				const matches = available.get(drawable.id) ?? [];
				const index = matches.findIndex((part) => sameGeometry(part.drawable, drawable));
				if (index >= 0) {
					const [part] = matches.splice(index, 1);
					part.drawable = drawable;
					return part;
				}
				builds++;
				const part = project(drawable, strokes, palette, landscape);
				added.push(part);
				return part;
			});
			const stale = [...available.values()].flat();
			// Retained parts stay in the group: detaching only the stale ones keeps an update linear
			// in the number of parts instead of splicing every child out and back in.
			const detached = new Set<Object3D>(stale.flatMap(({ mesh, lines }) => [mesh, ...lines]));
			if (detached.size) {
				group.children = group.children.filter((child) => !detached.has(child));
				for (const child of detached) {
					child.parent = null;
					child.dispatchEvent({ type: 'removed' });
				}
			}
			for (const part of stale) disposePart(part);
			for (const { mesh, lines } of added) group.add(mesh, ...lines);
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
