// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { expect, test } from 'bun:test';
import { applyStroke, createWorld, strokePreview, traceStroke, type Tool } from './index';

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
