import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { createWorld } from '../../logic/sandbox';
import { createCellPicker } from './house-picker';
import { createView } from './view';
import { surfaceGeometry } from './terrain-geometry';

test('terrain occludes a house solid farther along the camera ray', () => {
	const world = createWorld(7);
	const view = createView();
	view.resize(1200, 800);
	const ground = new THREE.Mesh(surfaceGeometry(world.grid), new THREE.MeshBasicMaterial());
	view.frameBox(new THREE.Box3().setFromObject(ground), 1.1);
	const ray = new THREE.Raycaster();
	ray.setFromCamera(view.ndc(560, 443), view.camera);
	const terrainHit = ray.intersectObject(ground, false)[0];
	assert.ok(terrainHit?.faceIndex != null);
	const buried = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), ground.material);
	buried.position.copy(terrainHit.point).addScaledVector(ray.ray.direction, 12);
	buried.updateMatrixWorld();
	assert.ok(ray.intersectObject(buried, false)[0].distance > terrainHit.distance);
	assert.equal(createCellPicker(view)(560, 443, world.grid, [buried]), terrainHit.faceIndex >> 1);
	buried.geometry.dispose();
	ground.geometry.dispose();
	ground.material.dispose();
});
