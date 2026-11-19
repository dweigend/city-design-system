// @ts-expect-error Bun provides the test API.
import { expect, test } from 'bun:test';
import { focuses } from '../presentation';
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
	const { timeLayers, ...old } = world.state;
	expect(timeLayers).toEqual([]);
	const snapshot = {
		...old,
		nextAction: 7,
		storyParts: new Map([[cellId, [...parts, kept]]]),
		stacks: new Map([[cellId, Array<'water'>(6).fill('water')]])
	};
	const restored = withState(world, snapshot);
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
