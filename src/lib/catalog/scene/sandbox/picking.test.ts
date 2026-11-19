import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import init from 'manifold-3d';
import { createRoofBuilder } from '../../logic/building-envelope';
import { createWorld, beginStroke, extendStroke, type World } from '../../logic/sandbox';
import { createView } from './view';
import { createCellPicker } from './house-picker';
import { surfaceGeometry } from './terrain-geometry';

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
	const ground = new THREE.Mesh(surfaceGeometry(world.grid), new THREE.MeshBasicMaterial());
	view.frameBox(new THREE.Box3().setFromObject(ground), 1.1);
	const picker = createCellPicker(view, () => ground);
	function cell(w: World, x: number, y: number) {
		picker.update(w);
		const index = picker.pick(x, y);
		assert.ok(index !== undefined);
		return w.grid.cells[index].id;
	}
	const draw = (next: World) => {
		let stroke = beginStroke({ kind: 'house', use: 'living' }, world);
		for (const w of [world, next]) stroke = extendStroke(stroke, cell(w, 560, 443));
		return stroke;
	};
	try {
		const bare = { ...world, state: { ...world.state, stacks: new Map() } };
		assert.equal(cell(bare, 560, 443), '78/39');
		const before = draw(world),
			after = draw(ready);
		assert.deepEqual(before.cellIds, ['79/38']);
		assert.deepEqual(after.cellIds, before.cellIds);
		assert.deepEqual(after.draft.state, before.draft.state);
		for (const w of [world, ready]) {
			const target = cell(w, 560, 443);
			const { draft } = extendStroke(beginStroke({ kind: 'erase' }, w), target);
			assert.equal(w.state.stacks.get('79/38')?.length, 1);
			assert.equal(draft.state.stacks.has('79/38'), false);
			assert.equal(draft.state.stacks.get('78/39'), w.state.stacks.get('78/39'));
			assert.notEqual(cell(draft, 560, 443), '79/38');
		}
	} finally {
		picker.dispose();
		ground.geometry.dispose();
		ground.material.dispose();
	}
});
