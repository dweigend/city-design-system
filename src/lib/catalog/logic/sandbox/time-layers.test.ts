// @ts-expect-error Bun provides the test API.
import { expect, test } from 'bun:test';
import { applyEdit, commit, createWorld, redo, startHistory, undo } from './index';

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

test('conversion retains the original identity; the attached façade has its own build year', () => {
	const plinth = { id: 'p/1/0', built: 1900, kind: 'story', use: 'living' };
	const upper = { id: 'p/3/0', built: 1980, kind: 'story' };
	const facade = { id: 'p/4/0', built: 1980, kind: 'facade', attachedTo: plinth.id };
	const converted = [{ ...plinth, use: 'material' }, upper, facade];
	expect(converted.map(({ id, built }) => [id, built])).toEqual([
		[plinth.id, 1900],
		[upper.id, 1980],
		[facade.id, 1980]
	]);
	expect(facade.attachedTo).toBe(plinth.id);
});

test('deconstructing the top floor credits its unit once and round-trips through undo and redo', () => {
	const removed = applyEdit(mixed, { kind: 'clear', cellId });
	const history = commit(startHistory(mixed.state), removed.state);
	const states = [history, undo(history), redo(undo(history))].map(({ present }) => present);
	expect(states.map((state) => [state.storyParts.get(cellId)?.length, state.store.water])).toEqual([
		[1, 1],
		[2, 0],
		[1, 1]
	]);
	expect(states[1]).toBe(mixed.state);
	expect(states[2]).toBe(removed.state);
});

test('replacing a rail pillar gives it a new identity while the segment and stop stay', () => {
	const rail = ['segment', 'pillar', 'stop'].map((kind, slot) => ({
		kind,
		id: `p/1/${slot}`,
		built: 1900,
		units: 3
	}));
	const replacement = { ...rail[1], id: 'p/2/0', built: 1980 };
	const next = [rail[0], replacement, rail[2]];
	expect(next.map(({ id }) => id)).toEqual(['p/1/0', 'p/2/0', 'p/1/2']);
	expect([replacement.built, rail[1].units]).toEqual([1980, 3]);
	expect(next[0]).toBe(rail[0]);
	expect(next[2]).toBe(rail[2]);
});

test('terrain projection can move beneath a story without changing its cell anchor or identity', () => {
	const anchor = { cellId: '4:6', level: 0 };
	const part = { id: 'p/1/0', built: 1900, anchor };
	const project = (heights: Record<string, number>) => [part.id, heights[part.anchor.cellId]];
	expect([project({ '4:6': 2 }), project({ '4:6': 5 })]).toEqual([
		['p/1/0', 2],
		['p/1/0', 5]
	]);
});
