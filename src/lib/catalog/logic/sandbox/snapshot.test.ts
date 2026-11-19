// @ts-expect-error Bun provides the test API.
import { expect, test } from 'bun:test';
import { focuses } from '../presentation';
import legacyTown from './fixtures/seed-7-c67d10e.json';
import type { StoryPart } from './state';
import type { CoverKind } from '../land-cover';
import { applyEdit, createWorld, currentStacks, houseView, withState } from './index';

test('old snapshots recover their historical methods once and can advance', () => {
	const world = createWorld(7, { year: 2029, cells: 0 });
	const cellId = '30/30';
	const built = [1979, 1980, 2027, 2028, 2029];
	const parts = built.map((year, level) => ({
		id: `p/${level + 1}/0`,
		built: year,
		anchor: { cellId, level }
	}));
	const kept = { ...parts[4], id: 'p/6/0', anchor: { cellId, level: 5 }, style: 'totem' as const };
	const { parts: oldParts, compositions: oldOwners, timeLayers, ...old } = world.state;
	expect(oldParts.size + oldOwners.size).toBe(0);
	expect(timeLayers).toEqual([]);
	const snapshot = {
		...old,
		nextAction: 7,
		storyParts: new Map([[cellId, [...parts, kept]]]),
		stacks: new Map([[cellId, Array<'water'>(6).fill('water')]])
	};
	const restored = withState(world, snapshot);
	expect(restored.state.parts.size + restored.state.compositions.size).toBe(0);
	const stories = restored.state.storyParts.get(cellId);
	expect(stories?.map((part) => part.style)).toEqual([
		'terrace',
		'collage',
		'megastructure',
		'totem',
		'collage',
		'totem'
	]);
	expect(stories?.map(({ id, built, anchor }) => ({ id, built, anchor }))).toEqual([
		...parts,
		{ id: kept.id, built: kept.built, anchor: kept.anchor }
	]);
	expect(stories?.[5]).toBe(kept);
	const chunk = restored.grid.cellsById.get(cellId)?.chunk ?? '';
	const projection = houseView(restored, currentStacks(restored.state), chunk, focuses.all);
	expect(
		projection.some((part) => part.kind === 'capsule' && part.id.startsWith(cellId + '@3'))
	).toBe(true);
	expect(
		projection.some(
			(part) =>
				part.kind === 'polyline' && part.id.startsWith(cellId + '@2') && part.id.includes('strut')
		)
	).toBe(true);
	expect(restored.state.timeLayers.map((layer) => layer.year)).toEqual(built.slice(0, -1));
	expect(withState(restored, restored.state)).toBe(restored);
	const advanced = applyEdit(restored, { kind: 'advance' });
	expect(advanced.state.year).toBe(2054);
	expect(advanced.state.storyParts.get(cellId)).toBe(stories);
	expect(advanced.state.timeLayers.map((layer) => layer.year)).toEqual(built);
	expect('timeLayers' in snapshot).toBe(false);
	expect('style' in parts[2]).toBe(false);
});

test('the seeded old town is the first layer and empty advances leave its markers alone', () => {
	const town = createWorld(7);
	const oldTown = [{ year: 1900, flows: ['people'] }];
	expect(town.state.timeLayers).toEqual(oldTown);
	const emptyAdvance = applyEdit(town, { kind: 'advance' });
	expect(emptyAdvance.state.year).toBe(2051);
	expect(emptyAdvance.state.timeLayers).toBe(town.state.timeLayers);

	const restored = withState(town, {
		...emptyAdvance.state,
		timeLayers: [{ year: 2026, flows: [] }]
	});
	expect(restored.state.timeLayers).toEqual(oldTown);
	expect(createWorld(7, { cells: 0 }).state.timeLayers).toEqual([]);

	const painted = applyEdit(emptyAdvance, { kind: 'raise', cellId: '30/30', use: 'water' });
	const aged = applyEdit(painted, { kind: 'advance' });
	expect(aged.state.timeLayers).toEqual([...oldTown, { year: 2051, flows: ['water'] }]);
	expect(applyEdit(aged, { kind: 'advance' }).state.timeLayers).toBe(aged.state.timeLayers);
});

test('loading legacy cover removes the main-alley forest immediately and keeps dry landlocked forest', () => {
	const world = createWorld(7, { cells: 0 });
	const cover = new Map([
		['82/20', 'forest'],
		['102/44', 'forest']
	] as const);
	const snapshot = { ...world.state, cover };
	const restored = withState(world, snapshot);
	expect(restored.grid.cellsById.get('82/20')).toMatchObject({
		plan: { kind: 'mainAlley' },
		plantable: false
	});
	expect(restored.state.cover).toEqual(new Map([['102/44', 'forest']]));
	expect(restored.state.store).toBe(snapshot.store);
	expect(snapshot.cover.has('82/20')).toBe(true);
	expect(withState(restored, restored.state)).toBe(restored);
	const dug = applyEdit(restored, { kind: 'dig', cellId: '120/68' });
	expect(dug.state.cover).toBe(restored.state.cover);
});

test('the c67d10e seed-7 save retains every occupied cell and construction record', () => {
	const world = createWorld(7);
	// The original town has consecutive part IDs and only 1900 terrace housing.
	const stacks = new Map<string, 'living'[]>();
	const storyParts = new Map<string, StoryPart[]>();
	const { heights, meadows, ...header } = legacyTown;
	let slot = 0;
	for (const [cellId, height] of Object.entries(heights)) {
		stacks.set(cellId, Array<'living'>(height).fill('living'));
		storyParts.set(
			cellId,
			Array.from({ length: height }, (_, level) => ({
				id: 'p/0/' + slot++,
				anchor: { cellId, level },
				built: 1900,
				style: 'terrace'
			}))
		);
	}
	const cover = new Map<string, CoverKind>(meadows.map((id) => [id, 'meadow']));
	const snapshot = {
		...header,
		timeLayers: [{ year: header.timeLayers[0].year, flows: ['people'] as const }],
		stacks,
		storyParts,
		cover
	};
	expect(stacks.size).toBe(210);
	expect(slot).toBe(444);
	for (const saved of [snapshot, { ...snapshot, cover: new Map(cover).set('82/20', 'forest') }]) {
		const restored = withState(world, saved);
		expect(restored.state.stacks).toBe(stacks);
		expect(restored.state.storyParts).toBe(storyParts);
		expect(restored.state.store).toBe(saved.store);
		expect(restored.state.cover.has('82/20')).toBe(false);
		const dug = applyEdit(restored, { kind: 'dig', cellId: '120/68' });
		expect(dug.state.stacks).toBe(stacks);
	}
});
