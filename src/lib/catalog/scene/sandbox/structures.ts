/** Owns the GPU objects for each key of the sandbox's derived structures. */
import * as THREE from 'three/webgpu';
import type { Primitive } from '../../logic/parametrik/types';
import { populateStructures } from './structure-parts';
import { structureMaterials } from './structure-materials';

export type Structures = ReturnType<typeof createStructures>;

/** Creates the structure layer. The caller adds the group to its scene and disposes it. */
export function createStructures() {
	const group = new THREE.Group();
	const dot = new THREE.SphereGeometry(0.25, 12, 8);
	const finishes = structureMaterials();
	const entries = new Map<string, { primitives: Primitive[]; objects: THREE.Group }>();

	function release(objects: THREE.Group) {
		group.remove(objects);
		for (const object of objects.children) {
			if (object instanceof THREE.InstancedMesh) object.dispose();
			else if (object instanceof THREE.Mesh) object.geometry.dispose();
		}
	}

	/** Replaces the primitives stored under a key; an empty list removes the key. */
	function set(key: string, primitives: Primitive[]) {
		const previous = entries.get(key);
		if (previous) release(previous.objects);
		entries.delete(key);
		if (!primitives.length) return;
		// Reuse the inset walls and terrace slabs as pick surfaces. Roof detail shares
		// their rendering style but cannot enlarge the kernel-independent target.
		const detail = primitives.filter(part => part.pickable === false);
		const body = detail.length ? primitives.filter(part => part.pickable !== false) : primitives;
		const objects = populateStructures(body, finishes, dot);
		if (detail.length) {
			const roof = populateStructures(detail, finishes, dot);
			objects.add(...roof.children.slice());
		}
		group.add(objects);
		entries.set(key, { primitives, objects });
	}

	function rebuild() {
		for (const [key, entry] of [...entries]) set(key, entry.primitives);
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
		setStyle(...args: Parameters<typeof finishes.setStyle>) {
			if (finishes.setStyle(...args)) rebuild();
		},
		/** Updates sandbox-only material settings in schema units. */
		setParams: finishes.setParams,
		/** Solid meshes of every key with the given prefix, for ray casting. */
		solids(prefix: string): THREE.Mesh[] {
			return [...entries]
				.filter(([key]) => key.startsWith(prefix))
				.flatMap(([, entry]) => entry.objects.userData.hits as THREE.Mesh[]);
		},
		/** Releases all geometry and materials. */
		dispose() {
			clear();
			dot.dispose();
			finishes.dispose();
		}
	};
}
