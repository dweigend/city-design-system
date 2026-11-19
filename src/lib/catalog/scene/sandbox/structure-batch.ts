import type * as THREE from 'three/webgpu';
import type { Primitive } from '../../logic/parametrik/types';
import type { DistanceDrawing } from './distance-drawing';
import { roofPick } from './roof-pick';
import { populateStructures } from './structure-parts';
import type { StructureMaterials } from './structure-materials';

/** Drawable batch and its detached, seated ray targets, all in baked world coordinates. */
export function structureBatch(
	primitives: Primitive[],
	finishes: StructureMaterials,
	dot: THREE.BufferGeometry,
	drawing?: DistanceDrawing
) {
	const parts = drawing?.parts ?? primitives;
	const roofs = parts.filter((part) => part.roofCell);
	const body = roofs.length ? parts.filter((part) => !part.roofCell) : parts;
	const group = populateStructures(body, finishes, dot, drawing);
	const targets = detachedTargets(group);
	if (roofs.length) {
		const details = populateStructures(roofs, finishes, dot, drawing);
		group.add(...details.children.slice());
		for (const part of roofs) {
			const proxy = roofPick(part, () => roofWidth(part, finishes));
			if (proxy) targets.push(proxy);
		}
	}
	return { group, targets };
}

function roofWidth(part: Primitive, { materials }: StructureMaterials) {
	const material =
		part.material === 'ghost' || part.role === 'neu' ? materials.detail : materials.pencil;
	return material.linewidth;
}

function detachedTargets(group: THREE.Group) {
	const hits: THREE.Object3D[] = group.userData.hits;
	return hits.map((solid) => solid.clone(false));
}
