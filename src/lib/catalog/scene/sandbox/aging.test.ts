import { expect, test } from 'bun:test';
import {
	applyEdit,
	beginStroke,
	commit,
	createWorld,
	extendStroke,
	startHistory,
	undo,
	withState
} from '../../logic/sandbox';
import type { Primitive } from '../../logic/parametrik/types';
import { KEY, projectChanges } from './projection';
import { createTerrainMesh } from './terrain-mesh';

test('advancing tints painted houses gradually and preserves path and rail ink exactly', () => {
	const before = createWorld(7, { cells: 0 });
	const painted = applyEdit(before, {
		kind: 'raise',
		cellId: '30/30',
		use: 'water',
		style: 'totem'
	});
	const path = ['30/35', '35/37'].reduce(
		extendStroke,
		beginStroke({ kind: 'line', transit: 'walkway' }, painted)
	).draft;
	const built = applyEdit(path, {
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
		const freshPath = parts(KEY.installation);
		const capsule = freshHouse.find((part) => part.kind === 'capsule');
		expect(capsule).toMatchObject({
			role: 'neu',
			edges: false,
			token: '--cat-health',
			envelope: true
		});
		expect(freshHouse.some((part) => part.token === '--cat-health')).toBe(true);
		expect(freshRail.find((part) => part.id.endsWith('/deck'))).toMatchObject({
			token: '--paper',
			finish: 'metall-kupfer'
		});
		expect(freshPath.some((part) => part.token === '--cat-business')).toBe(true);

		projectChanges(target, built, aged, 'all', false);
		const ageTint = 0.06;
		for (const part of freshHouse.filter(({ role }) => role === 'neu'))
			expect(parts(KEY.house).find(({ id }) => id === part.id)).toMatchObject({
				role: part.role,
				token: part.token,
				ageTint
			});
		// Force a rebuild to exercise the aged records, not just the retained batches.
		projectChanges(target, aged, aged, 'all', true);
		expect(parts(KEY.line)).toEqual(freshRail);
		expect(parts(KEY.installation)).toEqual(freshPath);

		const history = commit(startHistory(built.state), aged.state);
		projectChanges(target, aged, withState(aged, undo(history).present), 'all', false);
		expect(parts(KEY.house)).toEqual(freshHouse);
		expect(parts(KEY.line)).toEqual(freshRail);
	} finally {
		terrain.dispose();
	}
});

test('a painted ground-floor body keeps its shell and receives the shared age tint in later years', () => {
	const before = createWorld(7, { cells: 0 });
	const built = applyEdit(before, { kind: 'raise', cellId: '30/30', use: 'living' });
	const aged = applyEdit(built, { kind: 'advance' });
	const terrain = createTerrainMesh(before.grid);
	const drawn = new Map<string, Primitive[]>();
	const target = { terrain, structures: { set: drawn.set.bind(drawn) } };
	const shell = () =>
		[...drawn.values()].flat().filter((part) => part.id.startsWith('30/30/level/0/body/'));
	try {
		projectChanges(target, before, built, 'all', false);
		const fresh = shell();
		expect(fresh).toContainEqual(
			expect.objectContaining({
				kind: 'prism',
				role: 'neu',
				buildingSurface: { slot: 'shell', use: 'living', ensemble: '30/30' }
			})
		);
		projectChanges(target, built, aged, 'all', false);
		expect(shell()).toEqual(fresh.map((part) => ({ ...part, ageTint: 0.06 })));
	} finally {
		terrain.dispose();
	}
});
