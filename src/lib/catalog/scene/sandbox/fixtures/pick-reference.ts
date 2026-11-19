import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import { focuses } from '../../../logic/presentation';
import { currentStacks, houseView, type World } from '../../../logic/sandbox';
/** Builds independent Three.js reference solids and strokes from the same displayed primitives. */
export async function render(world: World) {
	const { createStructures } = await import('../structures');
	const { batch, geometryOf } = await import('../../batch');
	const structures = createStructures();
	const color = new THREE.Color();
	const material = new THREE.MeshBasicMaterial();
	const visible: THREE.Object3D[] = [];
	const geometry: THREE.BufferGeometry[] = [];
	const strokeMaterial = new THREE.LineBasicMaterial();
	const targets: THREE.Vector3[] = [];
	for (const chunk of world.grid.chunks.keys()) {
		const parts = houseView(world, currentStacks(world.state), chunk, focuses.all);
		if (!parts.length) continue;
		structures.set('house:' + chunk, parts);
		const faces = batch(
			parts.filter((p) => !p.roofCell),
			() => color
		);
		for (const set of [faces.alt, faces.neu])
			if (set.p.length) {
				const g = geometryOf(set);
				geometry.push(g);
				visible.push(new THREE.Mesh(g, material));
			}
		for (const part of parts) {
			if (!part.roofCell) continue;
			const cell = world.grid.cellsById.get(part.roofCell);
			assert.ok(cell);
			if (part.kind !== 'mesh' && part.kind !== 'polyline') continue;
			const pos = part.points.flatMap(([x, y, z]) => [x, z, -y]);
			const g = new THREE.BufferGeometry().setAttribute(
				'position',
				new THREE.Float32BufferAttribute(pos, 3)
			);
			geometry.push(g);
			let reference: THREE.Object3D;
			if (part.kind === 'mesh') {
				g.setIndex(part.triangles);
				reference = new THREE.Mesh(g, material);
			} else reference = new THREE.Line(g, strokeMaterial);
			reference.userData.cellId = cell.id;
			visible.push(reference);
			if (part.kind === 'mesh' || part.id.endsWith(':ridge'))
				targets.push(new THREE.Vector3(cell.center[0], part.points[0][2], -cell.center[1]));
		}
	}
	return {
		solids: structures.solids('house:'),
		visible,
		targets,
		dispose() {
			structures.dispose();
			for (const g of geometry) g.dispose();
			material.dispose();
			strokeMaterial.dispose();
		}
	};
}
