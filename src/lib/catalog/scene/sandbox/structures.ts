/** Owns the GPU objects for each key of the sandbox's derived structures. */
import * as THREE from 'three/webgpu';
import type { Primitive } from '../../logic/parametrik/types';
import { roofPick } from './roof-pick';
import { populateStructures } from './structure-parts';
import {
	distanceDrawing,
	sameDrawing,
	type DistanceDrawing,
	type DrawingDistance
} from './distance-drawing';
import { structureMaterials } from './structure-materials';

export type Structures = ReturnType<typeof createStructures>;

/** Creates the structure layer. The caller adds the group to its scene and disposes it. */
export function createStructures() {
	const group = new THREE.Group();
	const dot = new THREE.SphereGeometry(0.25, 12, 8);
	const finishes = structureMaterials();
	const entries = new Map<
		string,
		{ primitives: Primitive[]; drawing: DistanceDrawing; objects: THREE.Group }
	>();
	let distance: DrawingDistance = { scale: Infinity, minContourPx: 0, elevation: 0, block: false };

	function release(objects: THREE.Group) {
		group.remove(objects);
		for (const object of objects.children) {
			if (object instanceof THREE.InstancedMesh) object.dispose();
			else if (object instanceof THREE.Mesh) object.geometry.dispose();
		}
	}

	function draw(drawing: DistanceDrawing) {
		const roofs = drawing.parts.filter((p) => p.roofCell);
		const body = roofs.length ? drawing.parts.filter((p) => !p.roofCell) : drawing.parts;
		const objects = populateStructures(body, finishes, dot, drawing);
		if (roofs.length) {
			const details = populateStructures(roofs, finishes, dot, drawing);
			objects.add(...details.children.slice());
			for (const part of roofs) {
				const width = () =>
					part.material === 'ghost' || part.role === 'neu'
						? finishes.materials.detail.linewidth
						: finishes.materials.pencil.linewidth;
				const proxy = roofPick(part, width);
				if (proxy) objects.userData.hits.push(proxy);
			}
		}
		group.add(objects);
		return objects;
	}

	/** Replaces the primitives stored under a key; an empty list removes the key. */
	function set(key: string, primitives: Primitive[]) {
		const previous = entries.get(key);
		if (previous) release(previous.objects);
		entries.delete(key);
		if (!primitives.length) return;
		const drawing = distanceDrawing(primitives, distance);
		entries.set(key, { primitives, drawing, objects: draw(drawing) });
	}

	function redraw(recolor: boolean) {
		for (const entry of entries.values()) {
			const drawing = distanceDrawing(entry.primitives, distance);
			if (!recolor && sameDrawing(entry.drawing, drawing)) continue;
			release(entry.objects);
			entry.drawing = drawing;
			entry.objects = draw(drawing);
		}
	}

	/** Removes every key. */
	function clear() {
		for (const key of [...entries.keys()]) set(key, []);
	}

	return {
		group,
		set,
		clear,
		/** Updates material roles at the current zoom. Theme changes also re-bake vertex colors. */
		setStyle(args: Parameters<typeof finishes.setStyle>, elevation: number) {
			const [style, , scale] = args;
			const block = style.rollen.weg.level === 'block';
			const minContourPx = finishes.minContourPx();
			const recolor = finishes.setStyle(...args);
			if (
				recolor ||
				scale !== distance.scale ||
				elevation !== distance.elevation ||
				block !== distance.block ||
				minContourPx !== distance.minContourPx
			) {
				distance = { scale, elevation, block, minContourPx };
				redraw(recolor);
			}
		},
		/** Updates sandbox-only material settings in schema units. */
		setParams: finishes.setParams,
		/** Solid meshes of every key with the given prefix, for ray casting. */
		solids(prefix: string): THREE.Object3D[] {
			return [...entries]
				.filter(([key]) => key.startsWith(prefix))
				.flatMap(([, entry]) => entry.objects.userData.hits as THREE.Object3D[]);
		},
		/** Releases all geometry and materials. */
		dispose() {
			clear();
			dot.dispose();
			finishes.dispose();
		}
	};
}
