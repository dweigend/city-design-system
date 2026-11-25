import { Box3, Group, Mesh, MeshBasicNodeMaterial, Raycaster, Sphere, Vector3 } from 'three/webgpu';
import type { Bounds3, Vec2, Vec3 } from '../../core/geometry';
import type { Drawable } from '../surface';
import { chunkKey, displayedBounds, packChunk, type BatchedPart } from './batch';
import type { strokeMaterials } from './edges';
import { projectGround } from './ground';
import { projectPart, styleIndividual, warpPart } from './part';
import { batchMaterials, createRows, type PartLook } from './rows';
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
		a === b ||
		(a.id === b.id &&
			a.shape === b.shape &&
			a.boundaryStroke === b.boundaryStroke &&
			a.creaseAngleRad === b.creaseAngleRad &&
			a.creaseGroups === b.creaseGroups &&
			a.strokeSegments === b.strokeSegments &&
			a.terrainField === b.terrainField &&
			a.warp?.fill === b.warp?.fill &&
			a.warp?.stroke === b.warp?.stroke &&
			(a.finish === 'line') === (b.finish === 'line') &&
			(a.finish === 'terrain') === (b.finish === 'terrain') &&
			(a.finish === 'shadow') === (b.finish === 'shadow'))
	);
}

const ray = new Raycaster();
const origin = new Vector3();
const worldBounds = new Box3();
const meshBounds = new Box3();
const sphere = new Sphere();

function terrainIntersection(meshes: Mesh[], point: Vec3, direction: Vec3) {
	if (!meshes.length) return undefined;
	ray.set(origin.fromArray(point), new Vector3(...direction).normalize());
	worldBounds.makeEmpty();
	for (const mesh of meshes) {
		mesh.updateWorldMatrix(true, false);
		if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
		const bounds = mesh.geometry.boundingBox;
		if (bounds) worldBounds.union(meshBounds.copy(bounds).applyMatrix4(mesh.matrixWorld));
	}
	if (worldBounds.isEmpty()) return undefined;
	worldBounds.getBoundingSphere(sphere);
	ray.ray.origin.addScaledVector(
		ray.ray.direction,
		-(origin.distanceTo(sphere.center) + sphere.radius)
	);
	return ray.intersectObjects(meshes, false)[0];
}

/** The nearest point where a line through point meets one of the displayed meshes. */
export function rayHit(meshes: Mesh[], point: Vec3, direction: Vec3): Vec3 | undefined {
	const hit = terrainIntersection(meshes, point, direction);
	if (!hit) return;
	const { x, y, z } = hit.point;
	return [x, y, z];
}

function toBounds(box: Box3): Bounds3 {
	return box.isEmpty()
		? {
				min: /* Exact arithmetic: empty content uses zero bounds at the origin. */ [0, 0, 0],
				max: /* Exact arithmetic: empty content uses zero bounds at the origin. */ [0, 0, 0]
			}
		: { min: box.min.toArray(), max: box.max.toArray() };
}

/** Detach in linear time. Group.clear spreads the whole child list into remove(). */
export function detachChildren(group: Group) {
	const children = group.children;
	group.children = [];
	for (const child of children) {
		child.parent = null;
		child.dispatchEvent({ type: 'removed' });
	}
}

type Chunk = {
	key: string;
	group: Group;
	members: Set<BatchedPart>;
	packed?: ReturnType<typeof packChunk>;
};
type Part = BatchedPart & { chunk?: Chunk };

/** A color-only row update leaves mesh visibility, ordering and bounds alone. */
function updateBatchLook(part: Part, look: PartLook) {
	const { opacity, strokeOpacity, hidden, visible, veil, scale, offset } = look;
	const glass = part.drawable.finish === 'glass';
	const previous = part.look;
	if (
		previous?.opacity === opacity &&
		previous.strokeOpacity === strokeOpacity &&
		previous.hidden === hidden &&
		previous.visible === visible &&
		previous.veil === veil &&
		previous.scale === scale &&
		previous.offset === offset &&
		previous.glass === glass
	)
		return false;
	part.look = { opacity, strokeOpacity, hidden, visible, veil, scale, offset, glass };
	return true;
}

export type TerrainAnchor = Readonly<{ index: number; position: Vec3; warp: Vec2 }>;

export function displayTerrainAnchor(
	{ position: [x, y, z], warp: [dx, dy] }: TerrainAnchor,
	drawable?: Drawable
): Vec3 {
	const amount = drawable?.warp?.amount ?? 0;
	const scale = drawable?.vertical?.scale ?? 1;
	const pivot = drawable?.vertical?.pivot ?? 0;
	return [x + dx * amount, y + dy * amount, z * scale + pivot * (1 - scale)];
}

export function createContent(
	strokes: ReturnType<typeof strokeMaterials>,
	palette: ReturnType<typeof drawingPalette>,
	landscape: boolean
) {
	const group = new Group();
	const individuals = new Group();
	group.add(individuals);
	const rows = createRows();
	const materials = batchMaterials(rows, palette, strokes, landscape);
	const veil = new MeshBasicNodeMaterial({ colorWrite: false });
	const chunks = new Map<string, Chunk>();
	const repack = new Set<string>();
	const restyle = new Set<Part>();
	const terrain = new Set<Part>();
	const individualParts = new Set<Part>();
	let parts: Part[] = [];
	let ground: ReturnType<typeof projectGround> | undefined;
	const box = new Box3();
	const footprint = new Box3();
	const scratch = new Box3();
	let frameBounds = toBounds(box);
	let clippingBounds = frameBounds;
	let boundsDirty = true;
	let chunkBuilds = 0;
	let individualMaterials = 0;

	function removeGround() {
		if (!ground) return;
		group.remove(ground.shadow, ground.outline);
		ground.shadow.dispose();
		ground.outline.dispose();
		ground.shadow.geometry.dispose();
		ground.shadow.material.dispose();
		ground.outline.geometry.dispose();
		ground = undefined;
	}

	function fitGround() {
		const nextBox = new Box3();
		const nextFootprint = new Box3();
		for (const part of parts) nextBox.union(part.bounds);
		for (const part of parts) {
			if (part.bounds.min.z === nextBox.min.z) nextFootprint.union(part.bounds);
		}
		if (box.equals(nextBox) && footprint.equals(nextFootprint)) return;
		box.copy(nextBox);
		footprint.copy(nextFootprint);
		removeGround();
		if (footprint.isEmpty()) return;
		ground = projectGround(toBounds(box), toBounds(footprint), strokes.ground);
		ground.outline.visible = !landscape;
		group.add(ground.shadow, ground.outline);
	}

	function assign(part: Part, drawable: Drawable) {
		const previous = part.drawable;
		if (previous === drawable) return;
		part.drawable = drawable;
		if (previous.warp?.amount !== drawable.warp?.amount) {
			warpPart(part);
			boundsDirty = true;
		}
		if (previous.visible !== drawable.visible || previous.vertical !== drawable.vertical)
			boundsDirty = true;
		restyle.add(part);
	}

	function add(drawable: Drawable) {
		const part: Part = {
			...projectPart(drawable, strokes, palette, landscape),
			row: /* Exact arithmetic: an unallocated row is outside the nonnegative index range. */ -1
		};
		warpPart(part);
		if (part.fill) {
			individuals.add(part.fill.mesh);
			individualMaterials++;
		}
		for (const { line, owned } of part.individual) {
			individuals.add(line);
			if (owned) individualMaterials++;
		}
		if (part.fill || part.individual.length) individualParts.add(part);
		if (drawable.finish === 'terrain') terrain.add(part);
		if ((part.arrays?.indices.length && drawable.finish !== 'line') || part.sources.length) {
			part.row = rows.allocate();
			const key = chunkKey(part);
			const chunk = chunks.get(key) ?? { key, group: new Group(), members: new Set() };
			chunk.members.add(part);
			part.chunk = chunk;
			chunks.set(key, chunk);
			repack.add(key);
		}
		restyle.add(part);
		return part;
	}

	function remove(part: Part) {
		restyle.delete(part);
		terrain.delete(part);
		individualParts.delete(part);
		if (part.chunk) {
			part.chunk.members.delete(part);
			repack.add(part.chunk.key);
			rows.release(part.row);
		}
		const { fill, individual } = part;
		if (fill) {
			individualMaterials--;
			fill.mesh.removeFromParent();
			fill.veil?.removeFromParent();
			fill.veil?.dispose();
			fill.mesh.dispose();
			fill.mesh.geometry.dispose();
			fill.mesh.material.dispose();
			fill.drawing.atlas?.dispose();
		}
		const geometry = new Set(individual.map(({ line }) => line.geometry));
		for (const { line, owned } of individual) {
			line.removeFromParent();
			line.dispose();
			if (owned) {
				individualMaterials--;
				line.material.dispose();
			}
		}
		for (const item of geometry) item.dispose();
	}

	function refreshBounds() {
		if (!boundsDirty) return;
		boundsDirty = false;
		const visible = new Box3();
		const clipped = new Box3();
		for (const part of parts) {
			const { drawable, bounds } = part;
			if (drawable.visible === false || (bounds.isEmpty() && !part.individual.length)) continue;
			if (!bounds.isEmpty()) visible.union(bounds);
			const scale = drawable.vertical?.scale ?? 1;
			clipped.union(
				displayedBounds(part, scratch, scale, (drawable.vertical?.pivot ?? 0) * (1 - scale))
			);
		}
		frameBounds = toBounds(visible.isEmpty() ? box : visible);
		clippingBounds =
			clipped.equals(visible) && !visible.isEmpty() ? frameBounds : toBounds(clipped);
	}

	function unpack(chunk: Chunk) {
		chunk.group.removeFromParent();
		detachChildren(chunk.group);
		chunk.packed?.delete();
	}

	function terrainMeshes() {
		return [...terrain].flatMap(({ fill }) => (fill?.mesh.visible ? [fill.mesh] : []));
	}

	function locateGround(point: Vec3, direction: Vec3): TerrainAnchor | undefined {
		const hit = terrainIntersection(terrainMeshes(), point, direction);
		if (!hit) return;
		const index = parts.findIndex(({ fill }) => fill?.mesh === hit.object);
		const fill = parts[index]?.fill;
		if (!fill) return;
		const local = fill.mesh.worldToLocal(hit.point);
		const offsets = fill.warpTargets[0]?.offsets;
		let dx = 0;
		let dy = 0;
		if (offsets && hit.face && hit.barycoord) {
			const vertices = [hit.face.a, hit.face.b, hit.face.c];
			for (const [i, weight] of hit.barycoord.toArray().entries()) {
				const offset = vertices[i] * 2;
				dx += weight * offsets[offset];
				dy += weight * offsets[offset + 1];
			}
		}
		return {
			index,
			position: [local.x - dx * fill.warpAmount, local.y - dy * fill.warpAmount, local.z],
			warp: [dx, dy]
		};
	}

	return {
		group,
		get parts() {
			return parts;
		},
		get ground() {
			return ground;
		},
		get chunkBuilds() {
			return chunkBuilds;
		},
		get materialCount() {
			return materials.count + strokes.materials.size + Number(!!ground) + individualMaterials + 1;
		},
		get clippingBounds(): Bounds3 {
			refreshBounds();
			return clippingBounds;
		},
		get bounds(): Bounds3 {
			refreshBounds();
			return frameBounds;
		},
		/** The displayed terrain point on a view ray through point, if any. */
		hit: (point: Vec3, direction: Vec3) => rayHit(terrainMeshes(), point, direction),
		locateGround,
		style(drawables: readonly Drawable[]) {
			if (!hasSameGeometry(parts, drawables))
				throw new Error('Presentation must retain drawable geometry');
			for (let i = 0; i < parts.length; i++) assign(parts[i], drawables[i]);
		},
		show(drawables: readonly Drawable[]) {
			let first = 0;
			let oldEnd = parts.length;
			let newEnd = drawables.length;
			while (
				first < oldEnd &&
				first < newEnd &&
				sameGeometry(parts[first].drawable, drawables[first])
			) {
				assign(parts[first], drawables[first]);
				first++;
			}
			if (first === oldEnd && first === newEnd) return 0;
			while (
				oldEnd > first &&
				newEnd > first &&
				sameGeometry(parts[oldEnd - 1].drawable, drawables[newEnd - 1])
			) {
				assign(parts[--oldEnd], drawables[--newEnd]);
			}

			const available = new Map<string, Part[]>();
			for (let i = first; i < oldEnd; i++) {
				const part = parts[i];
				const matches = available.get(part.drawable.id);
				if (matches) matches.push(part);
				else available.set(part.drawable.id, [part]);
			}
			let builds = 0;
			let groundChanged = false;
			let boundsChanged = false;
			const next = parts.slice(0, first);
			for (let i = first; i < newEnd; i++) {
				const drawable = drawables[i];
				const matches = available.get(drawable.id);
				const index = matches?.findIndex((part) => sameGeometry(part.drawable, drawable)) ?? -1;
				if (matches && index >= 0) {
					const [part] = matches.splice(index, 1);
					assign(part, drawable);
					next.push(part);
				} else {
					const part = add(drawable);
					next.push(part);
					groundChanged ||= !part.bounds.isEmpty();
					boundsChanged ||= !part.bounds.isEmpty() || part.individual.length > 0;
					builds++;
				}
			}
			for (let i = oldEnd; i < parts.length; i++) next.push(parts[i]);
			for (const matches of available.values())
				for (const part of matches) {
					groundChanged ||= !part.bounds.isEmpty();
					boundsChanged ||= !part.bounds.isEmpty() || part.individual.length > 0;
					remove(part);
				}
			parts = next;
			if (groundChanged) fitGround();
			if (groundChanged || boundsChanged) boundsDirty = true;
			return builds;
		},
		update(read: (drawable: Drawable, hasFill: boolean) => PartLook, all: boolean) {
			if (!all && !restyle.size && !repack.size) return;
			if (all) {
				materials.outer.color.copy(strokes.outer.color);
				materials.crease.color.copy(strokes.crease.color);
			}
			const refresh = new Set<Chunk>();
			for (const part of all ? parts : restyle) {
				const look = read(part.drawable, part.bounds.isEmpty() === false);
				if (part.chunk) {
					if (updateBatchLook(part, look)) refresh.add(part.chunk);
					rows.write(part.row, part.drawable, look);
				}
				if (part.fill || part.individual.length) styleIndividual(part, look, veil, landscape);
			}
			restyle.clear();
			for (const key of repack) {
				const chunk = chunks.get(key);
				if (!chunk) continue;
				if (chunk.members.size) {
					if (!chunk.packed) {
						chunk.packed = packChunk(materials, chunk.group, landscape);
						group.add(chunk.group);
					}
					chunk.packed.repack(chunk.members);
					refresh.add(chunk);
				} else {
					unpack(chunk);
					chunks.delete(key);
					refresh.delete(chunk);
				}
				chunkBuilds++;
			}
			repack.clear();
			for (const chunk of refresh) chunk.packed?.refresh();
			rows.flush();
		},
		delete() {
			removeGround();
			detachChildren(individuals);
			for (const part of individualParts) remove(part);
			for (const chunk of chunks.values()) unpack(chunk);
			detachChildren(group);
			materials.delete();
			veil.dispose();
			rows.delete();
			chunks.clear();
			terrain.clear();
			restyle.clear();
			repack.clear();
			parts = [];
		}
	};
}
