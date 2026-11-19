import { expect, test } from 'bun:test';
import {
	applyStroke,
	createWorld,
	openingScene,
	strokePreview,
	traceStroke,
	type Tool
} from './index';

const world = createWorld(7);
const first = '79/44';
const last = '81/44';
const tool: Tool = { kind: 'house', use: 'living' };
const blank: Parameters<typeof traceStroke>[1] = { cellIds: [], lastPointerCellId: undefined };

test('touch-down can preview a single cell on the unchanged world', () => {
	const trace = traceStroke(world.grid, blank, first);
	expect(strokePreview(world, tool, trace.cellIds).length).toBeGreaterThan(1);
	expect(applyStroke(world, tool, blank.cellIds).draft).toBe(world);
});

test('release fills crossed cells in order and paints each exactly once on a retrace', () => {
	const ids = [first, last, first].reduce<Parameters<typeof traceStroke>[1]>(
		(trace, id) => traceStroke(world.grid, trace, id),
		blank
	).cellIds;
	expect(ids).toEqual([first, '80/44', last]);
	const { draft: built } = applyStroke(world, tool, ids);
	expect(built.state.nextAction).toBe(world.state.nextAction + 3);
});

test('a short rail gesture has a dashed proposal and still needs a routable length to build', () => {
	const rail: Tool = { kind: 'line', transit: 'viaduct' };
	const ids = [first, '80/44'];
	expect(strokePreview(world, rail, ids)).toHaveLength(1);
	expect(applyStroke(world, rail, ids).draft).toBe(world);
});

test('digging and planting preview their own outlines without modifying terrain or cover', () => {
	expect(strokePreview(world, { kind: 'dig' }, [first])).toHaveLength(2);
	expect(strokePreview(world, { kind: 'cover', cover: 'forest' }, [first])).toHaveLength(4);
	expect(world.state.edits).toEqual([]);
	expect(world.state.cover.get(first)).not.toBe('forest');
});

test('one curved segment visits each cell exactly once before a dig is applied', () => {
	const trace = traceStroke(world.grid, traceStroke(world.grid, blank, '87/35'), '90/38');
	expect(trace.cellIds).toHaveLength(7);
	expect(new Set(trace.cellIds).size).toBe(7);
	const { draft } = applyStroke(world, { kind: 'dig' }, trace.cellIds);
	expect(draft.state.edits).toHaveLength(trace.cellIds.length);
});

test('the shore dig credits exactly the storeys removed from the opening town', () => {
	const before = openingScene(7).world;
	const { draft: after } = applyStroke(before, { kind: 'dig' }, ['76/41']);
	const removed = [...before.state.storyParts].flatMap(([id, stories]) =>
		stories.slice(after.state.storyParts.get(id)?.length ?? 0)
	);
	expect(after.state.edits).toHaveLength(1);
	expect(removed.length).toBeGreaterThan(0);
	for (const use of ['living', 'water', 'material', 'food', 'energy'] as const)
		expect(after.state.store[use] - before.state.store[use]).toBe(
			removed.filter(({ anchor }) => before.state.stacks.get(anchor.cellId)?.[anchor.level] === use)
				.length
		);
	for (const { anchor } of removed) {
		expect(after.grid.cellsById.get(anchor.cellId)?.buildable).toBe(false);
		expect(after.state.stacks.has(anchor.cellId)).toBe(false);
	}
});

test('release routes Q’s walkway through its survey and preserves both plazas', () => {
	const tool = { kind: 'line', transit: 'walkway' } as const;
	let trace = traceStroke(world.grid, blank, '30/35');
	trace = traceStroke(world.grid, trace, '35/37');
	const preview = strokePreview(world, tool, trace.cellIds);
	expect(preview.some((line) => line.length === 2)).toBe(true);
	const { draft, failure } = applyStroke(world, tool, trace.cellIds);
	expect(failure).toBeUndefined();
	expect([...draft.state.parts.values()].filter(({ recipe }) => recipe === 'plaza')).toHaveLength(
		2
	);
});
