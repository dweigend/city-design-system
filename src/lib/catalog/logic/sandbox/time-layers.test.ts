// @ts-expect-error Bun provides the test API.
import { expect, test } from 'bun:test';
import { focuses } from '../presentation';
import {
	applyEdit,
	beginStroke,
	commit,
	createWorld,
	currentStacks,
	extendStroke,
	houseView,
	redo,
	startHistory,
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

test('contract snapshot: conversion retains the original identity; the attached façade has its own build year', () => {
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

test('contract snapshot: replacing a rail pillar gives it a new identity while the segment and stop stay', () => {
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
	const cellId = '29/34';
	const before = applyEdit(base, { kind: 'raise', cellId, use: 'living' });
	const after = applyEdit(before, { kind: 'dig', cellId: '30/37' });
	const part = before.state.storyParts.get(cellId)?.[0];
	const elevation = (world: typeof base) => world.grid.cellsById.get(cellId)?.center[2] ?? 0;
	expect(elevation(after)).toBeLessThan(elevation(before) - 0.1);
	expect(part?.anchor).toEqual({ cellId, level: 0 });
	expect(after.state.storyParts.get(cellId)?.[0]).toBe(part);
});

test('three methods build in the same year and remain distinct when time advances and is undone', () => {
	const styles = ['collage', 'megastructure', 'totem'] as const;
	const built = styles.reduce(
		(world, style) =>
			extendStroke(beginStroke({ kind: 'house', use: 'water', style }, world), cellId).draft,
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
	for (const kind of ['sphere', 'capsule', 'polyline']) {
		const piece = fresh.find((part) => part.kind === kind && part.role === 'neu');
		expect(piece).toBeDefined();
		expect(view(aged).find((part) => part.id === piece?.id)).toMatchObject({
			kind,
			role: 'bestand'
		});
	}
	const history = commit(startHistory(built.state), aged.state);
	expect(view(withState(aged, undo(history).present))).toEqual(fresh);
	expect(applyEdit(aged, { kind: 'advance', years: -1 })).toBe(aged);
	expect(applyEdit(base, { kind: 'raise', cellId, use: 'living', style: 'totem' })).toBe(base);
});
