// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { describe, expect, test } from 'bun:test';
import { houseChunk, storiesOf } from '../house-brush';
import {
	applyEdit,
	beginStroke,
	changes,
	commit,
	createWorld,
	cursorFrame,
	extendStroke,
	redo,
	startHistory,
	undo,
	withState,
	type World
} from './index';

const SEED = 7;
const empty = createWorld(SEED);
const terrace = empty.grid.cells.filter((cell) => cell.zone === 'lower-terrace');
/** A dry cell with dry neighbors along its row. */
function site(world: World = empty) {
	const cell = world.grid.cells.find(
		(c) =>
			c.zone === 'lower-terrace' &&
			c.column === 30 &&
			world.grid.cellsById.get(`36/${c.row}`)?.zone === 'lower-terrace'
	);
	if (!cell) throw new Error('fixture missing');
	return cell;
}
const row = (from: number, to: number) => `${from}/${site().row}:${to}/${site().row}`.split(':');
const paint = (world: World, cellIds: string[], use: 'living' | 'water' = 'living') =>
	cellIds.reduce((w, cellId) => applyEdit(w, { kind: 'raise', cellId, use }), world);

describe('sandbox', () => {
	test('a stroke fills the gaps of a fast pointer and counts once per cell', () => {
		const [from, to] = row(30, 34);
		let stroke = beginStroke({ kind: 'house', use: 'living' }, empty);
		stroke = extendStroke(extendStroke(extendStroke(stroke, from), to), from);
		expect(stroke.cellIds).toHaveLength(5);
		for (const id of stroke.cellIds)
			expect(storiesOf(stroke.draft.state.stacks, id)).toEqual(['living']);
		expect(extendStroke(stroke, to)).toBe(stroke);
	});

	test('undo and redo return the saved states; a new stroke clears the redo', () => {
		const [a, b] = row(30, 31);
		const one = paint(empty, [a]);
		const two = paint(one, [b]);
		let history = commit(commit(startHistory(empty.state), one.state), two.state);
		history = undo(history);
		expect(history.present).toBe(one.state);
		expect(redo(history).present).toBe(two.state);
		expect(commit(history, empty.state).future).toHaveLength(0);
		expect(undo(startHistory(empty.state)).present).toBe(empty.state);
		expect(withState(two, one.state).state).toBe(one.state);
	});

	test('the eraser takes the story back into the store; the next house draws from it', () => {
		const [a] = row(30, 30);
		const built = paint(empty, [a, a], 'water');
		const erased = applyEdit(built, { kind: 'clear', cellId: a });
		expect(storiesOf(erased.state.stacks, a)).toEqual(['water']);
		expect(erased.state.store.water).toBe(1);
		expect(paint(erased, [a], 'water').state.store.water).toBe(0);
		expect(applyEdit(empty, { kind: 'clear', cellId: a })).toBe(empty);
	});

	test('digging a basin: the grid follows, cells keep their ids, flooded houses go to the store', () => {
		const cell = site();
		const ids = [cell.id, `${cell.column + 1}/${cell.row}`, `${cell.column + 8}/${cell.row}`];
		const built = paint(empty, ids);
		const dug = applyEdit(built, { kind: 'dig', cellId: cell.id });
		expect(dug.grid).not.toBe(built.grid);
		expect(dug.grid.cells.map((c) => c.id)).toEqual(built.grid.cells.map((c) => c.id));
		const stories = (world: World) =>
			ids.reduce((n, id) => n + storiesOf(world.state.stacks, id).length, 0);
		expect(stories(dug) + dug.state.store.living).toBe(3);
		expect(dug.state.store.living).toBeGreaterThan(0);
		// Every house left stands on ground that can carry it.
		for (const id of dug.state.stacks.keys())
			expect(dug.grid.cellsById.get(id)?.buildable).toBe(true);
		// The view redraws the terrain and the houses whose cells moved.
		const delta = changes(built, dug);
		expect(delta.terrain).toBe(true);
		expect(delta.houseChunks.has(cell.chunk)).toBe(true);
		// Undo restores houses and ground exactly.
		const back = withState(dug, built.state);
		expect(back.grid.cells).toEqual(built.grid.cells);
		expect(houseChunk(back.grid, back.state.stacks, cell.chunk, SEED)).toEqual(
			houseChunk(built.grid, built.state.stacks, cell.chunk, SEED)
		);
	});

	test('a line is stored as its stroke and routed on the current grid', () => {
		const [from, to] = row(20, 60);
		const lined = applyEdit(empty, { kind: 'line', transit: 'viaduct', cellIds: [from, to] });
		expect(lined.state.lines).toEqual([{ id: 'line1', transit: 'viaduct', cellIds: [from, to] }]);
		expect(lined.lines[0].path.length).toBeGreaterThan(20);
		expect(applyEdit(empty, { kind: 'line', transit: 'viaduct', cellIds: [from] })).toBe(empty);
		const dug = applyEdit(lined, { kind: 'dig', cellId: `40/${site().row}` });
		expect(dug.state.lines).toBe(lined.state.lines);
		expect(dug.lines[0]).not.toBe(lined.lines[0]);
		expect(changes(lined, dug).addedLines).toHaveLength(1);
	});

	test('the cursor previews the next story, the ground on water, the top story for the eraser', () => {
		const cell = site();
		const built = paint(empty, [cell.id]);
		expect(cursorFrame(empty.state, { kind: 'house', use: 'living' }, cell)).toHaveLength(6);
		expect(cursorFrame(built.state, { kind: 'erase' }, cell)[0][0][2]).toBe(cell.pad);
		const water = empty.grid.cells.find((c) => !c.buildable);
		expect(water && cursorFrame(empty.state, { kind: 'house', use: 'living' }, water)).toHaveLength(
			1
		);
		expect(terrace.length).toBeGreaterThan(100);
	});
});
