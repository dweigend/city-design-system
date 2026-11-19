import { batchFaces } from '../batch';
import { isStructural } from '../../logic/parametrik/types';
import * as THREE from 'three/webgpu';
import type { Primitive } from '../../logic/parametrik/types';
import type { DistanceDrawing } from './distance-drawing';
import { roofPick, seatedTargets } from './roof-pick';
import { populateStructures } from './structure-parts';
import type { StructureMaterials } from './structure-materials';

/** Drawable batch and its detached, seated ray targets, all in baked world coordinates. */
export function structureBatch(
	primitives: Primitive[],
	finishes: StructureMaterials,
	dot: THREE.BufferGeometry,
	drawing?: DistanceDrawing,
	cellId?: string
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
	if (cellId) for (const target of targets) target.userData.cellId = cellId;
	return { group, targets };
}

function roofWidth(part: Primitive, { materials }: StructureMaterials) {
	const material =
		part.material === 'ghost' || part.role === 'neu' ? materials.detail : materials.pencil;
	return material.linewidth;
}

function detachedTargets(group: THREE.Group) {
	const hits: THREE.Object3D[] = group.userData.hits;
	return seatedTargets(hits);
}

/** CPU-only stock surfaces and cell-owned roof hits. None of these objects enter the scene. */
export function stockPickTargets(parts: Primitive[], finishes: StructureMaterials) {
	const targets: THREE.Object3D[] = [];
	const solids: Primitive[] = [];
	const ghosts: Primitive[] = [];
	for (const part of parts) {
		if (part.roofCell) {
			const proxy = roofPick(part, () => roofWidth(part, finishes));
			if (proxy) targets.push(proxy);
		} else if (!part.detail || finishes.contours) {
			if (part.material === 'ghost') ghosts.push(part);
			else if (!isStructural(part)) solids.push(part);
		}
	}
	const white = new THREE.Color();
	addSurface(batchFaces(solids, () => white).alt.p, finishes.materials.stock);
	if (ghosts.length) {
		const faces = batchFaces(ghosts, () => white);
		for (const layer of [faces.alt, faces.glas, faces.blatt, faces.neu])
			addSurface(layer.p, finishes.materials.ghost);
	}
	return targets;

	function addSurface(positions: number[], material: THREE.Material) {
		if (!positions.length) return;
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
		targets.push(new THREE.Mesh(geometry, material));
	}
}
