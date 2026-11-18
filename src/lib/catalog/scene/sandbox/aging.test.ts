// @ts-expect-error Bun provides this test API at runtime.
import { expect, test } from 'bun:test';
import { applyEdit, commit, createWorld, startHistory, undo, withState } from '../../logic/sandbox';
import type { Primitive } from '../../logic/parametrik/types';
import { KEY, projectChanges } from './projection';
import { createTerrainMesh } from './terrain-mesh';

test('advancing redraws built houses and rail in pencil and undo restores their working colors', () => {
	const before = createWorld(7, { cells: 0 });
	const painted = applyEdit(before, {
		kind: 'raise',
		cellId: '30/30',
		use: 'water',
		style: 'totem'
	});
	const built = applyEdit(painted, {
		kind: 'line',
		transit: 'viaduct',
		cellIds: ['30/40', '40/40']
	});
	const aged = applyEdit(built, { kind: 'advance' });
	const terrain = createTerrainMesh(built.grid);
	const drawn = new Map<string, Primitive[]>();
	const target = { terrain, structures: { set: drawn.set.bind(drawn) } };
	const parts = (prefix: string) =>
		[...drawn].filter(([key]) => key.startsWith(prefix)).flatMap(([, items]) => items);
	try {
		projectChanges(target, before, built, 'all', false);
		const freshHouse = parts(KEY.house);
		const freshRail = parts(KEY.line);
		const capsule = freshHouse.find((part) => part.kind === 'capsule');
		expect(capsule).toMatchObject({ role: 'neu', edges: false });
		expect(freshHouse.some((part) => part.token === '--cat-health')).toBe(true);
		expect(freshRail.some((part) => part.token === '--cat-business')).toBe(true);

		projectChanges(target, built, aged, 'all', false);
		expect(parts(KEY.house).find((part) => part.id === capsule?.id)).toMatchObject({
			kind: 'capsule',
			token: '--paper',
			role: 'bestand',
			material: 'paper',
			edges: true
		});
		expect(parts(KEY.line).length).toBeGreaterThan(0);
		expect(
			parts(KEY.line).every((part) => part.role === 'bestand' && part.token === '--paper')
		).toBe(true);

		const history = commit(startHistory(built.state), aged.state);
		projectChanges(target, aged, withState(aged, undo(history).present), 'all', false);
		expect(parts(KEY.house)).toEqual(freshHouse);
		expect(parts(KEY.line)).toEqual(freshRail);
	} finally {
		terrain.dispose();
	}
});

test('a newly painted ground-floor collage shell becomes pencil at the next year', () => {
	const before = createWorld(7, { cells: 0 });
	const built = applyEdit(before, { kind: 'raise', cellId: '30/30', use: 'living' });
	const aged = applyEdit(built, { kind: 'advance' });
	const terrain = createTerrainMesh(before.grid);
	const drawn = new Map<string, Primitive[]>();
	const target = { terrain, structures: { set: drawn.set.bind(drawn) } };
	const shell = () => [...drawn.values()].flat().find((part) => part.id === '30/30@0:stock');
	try {
		projectChanges(target, before, built, 'all', false);
		expect(shell()).toMatchObject({ role: 'neu', kind: 'prism' });
		projectChanges(target, built, aged, 'all', false);
		expect(shell()).toMatchObject({ role: 'bestand', kind: 'prism', material: 'paper' });
	} finally {
		terrain.dispose();
	}
});
