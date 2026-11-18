// @ts-expect-error Bun provides the test API.
import { expect, test } from 'bun:test';
import { applyEdit, createWorld, commit, startHistory, undo, withState, changes } from './index';
import { styleForYear } from './index';
import { levelFor } from '../presentation';
const town = createWorld(7);
test('the old town occupies a reproducible set of lower terrace building sites', () => {
	expect(town.state.stacks).toEqual(createWorld(7).state.stacks);
	expect(town.state.stacks.size).toBeGreaterThanOrEqual(150);
	expect(town.state.stacks.size).toBeLessThanOrEqual(300);
	for (const id of town.state.stacks.keys()) {
		expect(town.grid.cellsById.get(id)).toMatchObject({ buildable: true, zone: 'lower-terrace' });
		expect(town.state.storyParts.get(id)?.every((part) => part.built < town.state.year)).toBe(true);
	}
});
test('stock takes a new floor, ages alongside a line and undo restores both', () => {
	const id = [...town.state.stacks.keys()][0];
	const raised = applyEdit(town, { kind: 'raise', cellId: id, use: 'water' });
	const built = applyEdit(raised, {
		kind: 'line',
		transit: 'viaduct',
		cellIds: ['30/40', '40/40']
	});
	const year = built.state.year;
	expect(built.state.storyParts.get(id)?.at(-1)?.built).toBe(year);
	expect(built.state.lines[0].year).toBe(year);
	const aged = applyEdit(built, { kind: 'advance' });
	expect(levelFor('all', 'houses', year, aged.state.year)).toBe('pencil');
	expect(changes(built, aged).addedLines).toHaveLength(1);
	const back = withState(aged, undo(commit(startHistory(built.state), aged.state)).present);
	expect(levelFor('all', 'rail', year, back.state.year)).toBe('full');
});

test('an erased story returns one unit and rebuilding at its anchor creates a fresh ID', () => {
	const cellId = [...town.state.stacks.keys()][0];
	const edit = { kind: 'raise', use: 'water', cellId } as const;
	const built = applyEdit(town, edit),
		cleared = applyEdit(built, { kind: 'clear', cellId });
	const replaced = applyEdit(cleared, edit);
	const top = (world: typeof town) => world.state.storyParts.get(cellId)?.at(-1);
	expect(top(built)?.id).not.toBe(top(replaced)?.id);
	expect(top(built)?.anchor).toEqual(top(replaced)?.anchor);
	expect(cleared.state.store.water).toBe(1);
	expect(undo(commit(startHistory(built.state), cleared.state)).present.store).toEqual(
		built.state.store
	);
	expect([1900, 1979, 1980, 2026].map(styleForYear)).toEqual([
		'collage',
		'collage',
		'megastructure',
		'totem'
	]);
});
