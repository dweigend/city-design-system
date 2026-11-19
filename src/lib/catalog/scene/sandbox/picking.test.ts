import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import init from 'manifold-3d';
import { createRoofBuilder } from '../../logic/building-envelope';
import { createWorld, beginStroke, extendStroke, type World } from '../../logic/sandbox';
import { createView } from './view';
import { createCellPicker, surfaceGeometry } from './terrain-geometry';

test('seed 7 paints the same cells when the roof builder becomes ready mid-stroke', async () => {
	const world = createWorld(7);
	const kernel = await init();
	kernel.setup();
	const ready = {
		...world,
		roofBuilder: createRoofBuilder(kernel, (_id, error) => {
			throw error;
		})
	};
	const view = createView();
	view.resize(1200, 800);
	const ground = new THREE.Mesh(surfaceGeometry(world.grid));
	view.frameBox(new THREE.Box3().setFromObject(ground), 1.1);
	const pickCell = createCellPicker(view, () => ground);
	function cell(w: World, x: number, y: number) {
		const index = pickCell(x, y);
		assert.ok(index !== undefined);
		return w.grid.cells[index].id;
	}
	const draw = (next: World) => {
		let stroke = beginStroke({ kind: 'house', use: 'living' }, world);
		for (const w of [world, next]) stroke = extendStroke(stroke, cell(w, 560, 443));
		return stroke;
	};
	try {
		const before = draw(world),
			after = draw(ready);
		assert.deepEqual(before.cellIds, ['78/39']);
		assert.deepEqual(after.cellIds, before.cellIds);
		assert.deepEqual(after.draft.state, before.draft.state);
	} finally {
		ground.geometry.dispose();
		ground.material.dispose();
	}
});
