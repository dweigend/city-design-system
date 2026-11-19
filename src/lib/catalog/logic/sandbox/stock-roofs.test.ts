import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoofBuilder } from '../building-envelope';
import init from 'manifold-3d';
import { focuses } from '../presentation';
import { applyEdit, changes, createWorld, currentStacks, houseView, type World } from './index';

test('all 210 seeded roofs are stable and a stroke rebuilds only affected chunks', () =>
	checkTown());

async function checkTown() {
	const kernel = await init();
	kernel.setup();
	const world = {
		...createWorld(7),
		roofBuilder: createRoofBuilder(kernel, (id, error) => {
			throw new Error(id, { cause: error });
		})
	};
	const roofs = (w: World, chunk: string) =>
		houseView(w, currentStacks(w.state), chunk, focuses.all).filter((p) => p.kind === 'mesh');
	const chunkKeys = [...world.grid.chunks.keys()];
	const initial = new Map(chunkKeys.map((chunk) => [chunk, roofs(world, chunk)]));
	assert.equal([...initial.values()].flat().length, 210);
	const cellId = [...world.state.stacks.keys()][0];
	const edited = applyEdit(world, { kind: 'raise', use: 'living', cellId });
	const dirty = changes(world, edited).houseChunks;
	assert.ok(dirty.size > 0 && dirty.size < chunkKeys.length);
	for (const chunk of chunkKeys) {
		assert.deepEqual(initial.get(chunk), roofs(world, chunk));
		if (!dirty.has(chunk)) assert.deepEqual(initial.get(chunk), roofs(edited, chunk));
	}
}
