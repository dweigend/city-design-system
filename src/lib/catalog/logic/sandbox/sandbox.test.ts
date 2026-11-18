// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { describe, expect, test } from 'bun:test';
import { houseChunk, storiesOf } from '../house-brush';
import { lineParts } from '../transit-line';
import {
	applyEdit,
	EMPTY_STATE,
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
const empty = withState(createWorld(SEED), EMPTY_STATE);
const terrace = empty.grid.cells.filter((cell) => cell.zone === 'lower-terrace');
/** A dry cell with dry neighbors along its row. */
function site(world: World = empty) {
	const cell = world.grid.cells.find(
		(c) =>
			c.zone === 'lower-terrace' &&
			c.column === 30 &&
			[0, 1, 8].every((dx) => world.grid.cellsById.get(`${c.column + dx}/${c.row}`)?.buildable) &&
			world.grid.cellsById.get(`36/${c.row}`)?.zone === 'lower-terrace'
	);
	if (!cell) throw new Error('fixture missing');
	return cell;
}
/** Cell id at an offset from a buildable block interior on dry ground. */
const at = (column: number, row: number) => {
	const origin = empty.grid.cells.find(
		(c) =>
			c.zone === 'lower-terrace' &&
			[0, 1, 2, 3, 4].every((dc) =>
				[0, 1].every((dr) => empty.grid.cellsById.get(`${c.column + dc}/${c.row + dr}`)?.buildable)
			)
	);
	if (!origin) throw new Error('fixture missing');
	return `${origin.column + column}/${origin.row + row}`;
};
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
		expect(extendStroke(stroke, from)).toBe(stroke);
		expect(extendStroke(stroke, 'unknown')).toBe(stroke);
	});

	test('the house brush fills from the pointer after retracing a row', () => {
		const stroke = [at(0, 0), at(4, 0), at(0, 0), at(1, 1)].reduce(
			extendStroke,
			beginStroke({ kind: 'house', use: 'living' }, empty)
		);
		const expected = [at(0, 0), at(1, 0), at(2, 0), at(3, 0), at(4, 0), at(0, 1), at(1, 1)];
		expect(stroke.cellIds).toEqual(expected);
		expect([...stroke.draft.state.stacks.keys()]).toEqual(expected);
		for (const id of expected) expect(storiesOf(stroke.draft.state.stacks, id)).toEqual(['living']);
	});

	test('the eraser fills from the pointer after retracing a row', () => {
		const rowIds = [at(0, 0), at(1, 0), at(2, 0), at(3, 0), at(4, 0)];
		const erasedIds = [...rowIds, at(0, 1), at(1, 1)];
		const untouchedIds = [at(2, 1), at(3, 1)];
		const built = paint(paint(empty, [...erasedIds, ...untouchedIds]), rowIds);
		const stroke = [at(0, 0), at(4, 0), at(0, 0), at(1, 1)].reduce(
			extendStroke,
			beginStroke({ kind: 'erase' }, built)
		);
		expect(stroke.cellIds).toEqual(erasedIds);
		for (const id of [...rowIds, ...untouchedIds])
			expect(storiesOf(stroke.draft.state.stacks, id)).toEqual(['living']);
		for (const id of [at(0, 1), at(1, 1)])
			expect(storiesOf(stroke.draft.state.stacks, id)).toEqual([]);
		expect(stroke.draft.state.store.living).toBe(erasedIds.length);
	});

	test('a zig-zag fills its segments in first-visit order', () => {
		const stroke = ['0/0', '2/0', '2/2', '4/2', '4/0', '2/0', '2/2'].reduce(
			extendStroke,
			beginStroke({ kind: 'house', use: 'living' }, empty)
		);
		expect(stroke.cellIds).toEqual([
			'0/0',
			'1/0',
			'2/0',
			'2/1',
			'2/2',
			'3/2',
			'4/2',
			'4/1',
			'4/0',
			'3/0'
		]);
		expect(stroke.lastPointerCellId).toBe('2/2');
	});

	test('a line crossing its own stroke routes through first visits only', () => {
		const crossed = ['0/1', '8/1', '8/3', '6/3', '6/0'].reduce(
			extendStroke,
			beginStroke({ kind: 'line', transit: 'viaduct' }, empty)
		);
		expect(crossed.draft.lines).toHaveLength(1);
		const retraced = extendStroke(extendStroke(crossed, '6/1'), '0/1');
		expect(retraced.draft).toBe(crossed.draft);
		expect(retraced.cellIds).toBe(crossed.cellIds);
		expect(retraced.lastPointerCellId).toBe('0/1');

		const stroke = extendStroke(retraced, '0/9');
		const expected = [
			'0/1',
			'1/1',
			'2/1',
			'3/1',
			'4/1',
			'5/1',
			'6/1',
			'7/1',
			'8/1',
			'8/2',
			'8/3',
			'7/3',
			'6/3',
			'6/2',
			'6/0',
			'0/2',
			'0/3',
			'0/4',
			'0/5',
			'0/6',
			'0/7',
			'0/8',
			'0/9'
		];
		expect(stroke.cellIds).toEqual(expected);
		expect(stroke.draft.state.lines).toEqual([
			{ id: 'line1', year: empty.state.year, transit: 'viaduct', cellIds: expected }
		]);
		expect(stroke.draft.lines[0].cellIds).toEqual(expected);
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
		expect(lined.state.lines).toEqual([
			{ id: 'line1', year: empty.state.year, transit: 'viaduct', cellIds: [from, to] }
		]);
		expect(lined.lines[0].path.length).toBeGreaterThan(20);
		expect(applyEdit(empty, { kind: 'line', transit: 'viaduct', cellIds: [from] })).toBe(empty);
		const dug = applyEdit(lined, { kind: 'dig', cellId: `40/${site().row}` });
		expect(dug.state.lines).toBe(lined.state.lines);
		expect(dug.lines[0]).not.toBe(lined.lines[0]);
		expect(changes(lined, dug).addedLines).toHaveLength(1);
	});

	test('line profile edits store only changes and survive regrid and undo', () => {
		const lined = applyEdit(empty, { kind: 'line', transit: 'viaduct', cellIds: row(20, 60) });
		const edit = { kind: 'line-profile', lineId: 'line1' } as const;
		const profile = { deckRadius: 0.8, clearance: 9 };
		const tuned = applyEdit(lined, { ...edit, profile });
		profile.deckRadius = 0.9;
		const dug = applyEdit(tuned, { kind: 'dig', cellId: '40/' + site().row });
		const history = commit(commit(startHistory(lined.state), tuned.state), dug.state);
		expect(dug.grid).not.toBe(tuned.grid);
		const restored = withState(dug, undo(history).present);
		for (const world of [tuned, dug, restored, withState(restored, redo(undo(history)).present)]) {
			expect(world.state.lines[0].profile).toEqual({ deckRadius: 0.8 });
			expect(lineParts(world.lines[0])[0]).toMatchObject({ radius: 0.8 });
		}
		expect(withState(restored, undo(undo(history)).present).lines[0].profile).toBeUndefined();
		expect(applyEdit(tuned, edit).state.lines[0]).toEqual(lined.state.lines[0]);
		expect(() => applyEdit(tuned, { ...edit, profile: { deckRadius: 100 } })).toThrow(RangeError);
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
