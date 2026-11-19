import { expect, test } from 'bun:test';
import { focuses } from '../presentation';
import {
	applyEdit,
	commit,
	createWorld,
	currentStacks,
	houseView,
	redo,
	startHistory,
	timelineWindow,
	undo,
	withState
} from './index';

const base = createWorld(7, { year: 1900, cells: 0 });
const cellId = '30/30';
const foundation = applyEdit(base, { kind: 'raise', cellId, use: 'living' });
const later = applyEdit(foundation, { kind: 'advance', years: 126 });
const mixed = applyEdit(later, { kind: 'raise', cellId, use: 'water', style: 'totem' });

test('building, aging and adding a floor keep both styles in the same stack', () => {
	const stories = mixed.state.storyParts.get(cellId);
	expect(stories?.map((part) => [part.id, part.style, mixed.state.year - part.built])).toEqual([
		['p/1/0', 'terrace', 126],
		['p/2/0', 'totem', 0]
	]);
	expect(mixed.state.stacks.get(cellId)).toEqual(['living', 'water']);
});

test.todo(
	'Conversion keeps a stable composition and gives a new façade its own build year (the sandbox has no composition IDs or addressable façades)'
);

test('deconstructing the top floor credits its unit once and round-trips through undo and redo', () => {
	const cellId = '86/43';
	const stock = createWorld(7);
	const built = applyEdit(stock, { kind: 'raise', cellId, use: 'water', style: 'collage' });
	const floors = stock.state.stacks.get(cellId)?.length ?? 0;
	expect(floors).toBeGreaterThan(0);
	const water = built.state.store.water;
	const removed = applyEdit(built, { kind: 'clear', cellId });
	const history = commit(startHistory(built.state), removed.state);
	const states = [history, undo(history), redo(undo(history))].map(({ present }) => present);
	expect(states.map((state) => [state.stacks.get(cellId)?.length, state.store.water])).toEqual([
		[floors, water + 1],
		[floors + 1, water],
		[floors, water + 1]
	]);
	expect(states[1]).toBe(built.state);
	expect(states[2]).toBe(removed.state);
});

test.todo(
	'Replacing a rail pillar keeps the segment and stop IDs (rail is stored as a whole stroke without addressable parts or a replacement action)'
);

test('terrain projection can move beneath a story without changing its cell anchor or identity', () => {
	const cellId = '29/34';
	const before = applyEdit(base, { kind: 'raise', cellId, use: 'living' });
	const after = applyEdit(before, { kind: 'dig', cellId: '30/37' });
	const part = before.state.storyParts.get(cellId)?.[0];
	const elevation = (world: typeof base) => world.grid.cellsById.get(cellId)?.center[2] ?? 0;
	expect(elevation(after)).toBeLessThan(elevation(before) - 0.1);
	expect(part?.anchor).toEqual({ cellId, level: 0 });
	expect(after.state.storyParts.get(cellId)?.[0]).toBe(part);
});

test('stories recorded with three methods in the same year remain distinct when time advances and is undone', () => {
	const styles = ['collage', 'megastructure', 'totem'] as const;
	const built = styles.reduce(
		(world, style) => applyEdit(world, { kind: 'raise', use: 'water', style, cellId }),
		later
	);
	const parts = built.state.storyParts.get(cellId);
	expect(parts?.slice(1).map(({ built, style }) => [built, style])).toEqual(
		styles.map((style) => [2026, style])
	);
	const chunk = built.grid.cellsById.get(cellId)?.chunk ?? '';
	const view = (world: typeof base) =>
		houseView(world, currentStacks(world.state), chunk, focuses.all);
	const fresh = view(built);
	const aged = applyEdit(built, { kind: 'advance' });
	expect(aged.state.year).toBe(2051);
	expect(aged.state.timeLayers).toEqual([
		{ year: 1900, flows: ['people'] },
		{ year: 2026, flows: ['water'] }
	]);
	expect(aged.state.storyParts.get(cellId)).toBe(parts);
	for (const [suffix, kind] of [
		[':wall', 'prism'],
		['/body', 'prism'],
		['/module', 'capsule']
	]) {
		const piece = fresh.find(
			(part) => part.id.endsWith(suffix) && part.role === 'neu' && part.token === '--cat-health'
		);
		expect(piece).toMatchObject({ kind, token: '--cat-health', envelope: true });
		expect(view(aged).find((part) => part.id === piece?.id)).toMatchObject({
			kind,
			role: 'neu',
			token: '--cat-health',
			ageTint: 0.06
		});
	}
	const history = commit(startHistory(built.state), aged.state);
	expect(view(withState(aged, undo(history).present))).toEqual(fresh);
	expect(applyEdit(aged, { kind: 'advance', years: -1 })).toBe(aged);
	expect(applyEdit(base, { kind: 'raise', cellId, use: 'living', style: 'totem' })).toBe(base);
});

test('the playable timeline keeps four generations in view through 2076 and the third advance', () => {
	const start = createWorld(7, { cells: 0 });
	const at2051 = applyEdit(start, { kind: 'advance' });
	const at2076 = applyEdit(at2051, { kind: 'advance' });
	const at2101 = applyEdit(at2076, { kind: 'advance' });
	const at2126 = applyEdit(at2101, { kind: 'advance' });
	for (const world of [start, at2051, at2076, at2101])
		expect(timelineWindow(start.state.year, world.state.year, 25)).toEqual({
			min: 2026,
			max: 2126
		});
	expect([at2076.state.year, at2101.state.year]).toEqual([2076, 2101]);
	expect(timelineWindow(start.state.year, at2126.state.year, 25).max).toBe(2151);
	expect(timelineWindow(start.state.year, start.state.year, 10).max).toBe(2066);
});
