import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import { focuses } from '../../../logic/presentation';
import type { Primitive } from '../../../logic/parametrik/types';
import { projectChanges } from '../projection';
import { createTerrainMesh } from '../terrain-mesh';
import { currentStacks, EMPTY_STATE, houseView, type World } from '../../../logic/sandbox';
/** Builds independent Three.js reference solids and strokes from the same displayed primitives. */
export async function render(world: World, animate = false) {
	const { createStructures } = await import('../structures');
	const { batch, geometryOf } = await import('../../batch');
	const structures = createStructures();
	const color = new THREE.Color();
	const material = new THREE.MeshBasicMaterial();
	const visible: THREE.Object3D[] = [];
	const geometry: THREE.BufferGeometry[] = [];
	const strokeMaterial = new THREE.LineBasicMaterial();
	const targets: THREE.Vector3[] = [];
	const terrain = createTerrainMesh(world.grid);
	const batches: Primitive[] = [];
	const referenceParts: Primitive[] = [];
	projectChanges(
		{
			terrain,
			structures: {
				set(key, parts) {
					if (!key.startsWith('house:')) return;
					batches.push(...parts);
					structures.set(key, parts, undefined, animate ? 0 : undefined);
				}
			}
		},
		{ ...world, state: EMPTY_STATE, lines: [] },
		world,
		'all',
		false
	);
	for (const chunk of world.grid.chunks.keys()) {
		const parts = houseView(world, currentStacks(world.state), chunk, focuses.all);
		if (!parts.length) continue;
		referenceParts.push(...parts);
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
		for (const part of parts) addRoofReference(part);
	}
	const ordered = (parts: Primitive[]) => parts.map((part) => JSON.stringify(part)).sort();
	assert.deepEqual(ordered(batches), ordered(referenceParts));
	return {
		solids: structures.solids('house:'),
		move(timeMs: number) {
			structures.step(timeMs, false);
			structures.group.updateMatrixWorld(true);
		},
		visible,
		targets,
		dispose() {
			structures.dispose();
			terrain.dispose();
			for (const g of geometry) g.dispose();
			material.dispose();
			strokeMaterial.dispose();
		}
	};
	function addRoofReference(part: Primitive) {
		if (!part.roofCell) return;
		const cell = world.grid.cellsById.get(part.roofCell);
		assert.ok(cell);
		if (part.kind !== 'mesh' && part.kind !== 'polyline') return;
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
