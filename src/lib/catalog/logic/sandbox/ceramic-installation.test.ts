// @ts-expect-error Bun supplies the test API.
import { expect, test, spyOn } from 'bun:test';
import {
	withState,
	beginStroke,
	commit,
	createWorld,
	extendStroke,
	installationView,
	startHistory,
	undo
} from './index';

test('the seed-7 water inlet on 90/40 is one owned, seated ceramic fitting with a blue annular lip', () => {
	const world = createWorld(7);
	const ids = ['90/40', '94/40'];
	const frame = ids.reduce(
		extendStroke,
		beginStroke({ kind: 'house', use: 'material', style: 'megastructure' }, world)
	).draft;
	const draw = (use: 'water' | 'energy') =>
		ids.reduce(extendStroke, beginStroke({ kind: 'house', style: 'totem', use }, frame)).draft;
	const group = draw('water');
	const modules = [...group.state.parts.values()].filter((p) => p.kind === 'module');
	expect(modules.map((p) => p.recipe)).toEqual(['capsule', 'capsule', 'ceramic']);
	expect(modules.every((p) => p.fit === 'profile-v1')).toBe(true);
	const piece = modules[2];
	const rod = group.state.parts.get(piece.attachedTo);
	expect(piece.owner).toBe(rod?.owner);
	expect(piece.anchor).toEqual(rod?.anchor);
	const forms = installationView(group, 'all');
	const meshes = forms.filter((p) => p.kind === 'mesh');
	expect(meshes.map((p) => [p.id, p.token, p.material, p.shade])).toEqual([
		[piece.id + '/fitting', '--paper', 'glaze', 0],
		[piece.id + '/fitting/lip', '--cat-health-3', 'glaze', 0]
	]);
	const [body, lip] = meshes;
	const support = forms.find((p) => p.id === rod?.id);
	if (support?.kind !== 'pipe') throw Error('Missing supporting chord');
	const z = support.points[0][2] + support.radius;
	expect(Math.min(...body.points.map((p) => p[2]))).toBeCloseTo(z, 8);
	const top = Math.max(...body.points.map((p) => p[2]));
	expect(top - z).toBeCloseTo(4, 8);
	expect(lip.points.every((p) => p[2] === top)).toBe(true);
	expect(lip.lines).toHaveLength(2);
	for (const axis of [0, 1]) {
		const coords = body.points.map((p) => p[axis]);
		expect(Math.max(...coords) - Math.min(...coords)).toBeLessThanOrEqual(3);
	}
	expect(undo(commit(startHistory(frame.state), group.state)).present).toBe(frame.state);
	expect(
		[...draw('energy').state.parts.values()].filter((p) => p.kind === 'module').map((p) => p.recipe)
	).toEqual(['capsule', 'capsule', 'solar-ring']);
});

test('accent socket and recipe survive a shuffled parts table', () => {
	const world = createWorld(7);
	for (const [from, to, recipe] of [
		['83/47', '87/47', 'tank'],
		['90/40', '94/40', 'ceramic']
	]) {
		const ids = [from, to];
		const frame = ids.reduce(
			extendStroke,
			beginStroke({ kind: 'house', style: 'megastructure', use: 'material' }, world)
		).draft;
		const draw = (parts: typeof frame.state.parts) =>
			ids.reduce(
				extendStroke,
				beginStroke(
					{ kind: 'house', style: 'totem', use: 'water' },
					{ ...frame, state: { ...frame.state, parts } }
				)
			).draft;
		const modules = (w: typeof world) =>
			[...w.state.parts.values()].filter((p) => p.kind === 'module');
		const first = modules(draw(frame.state.parts));
		expect(first.map((p) => p.recipe)).toEqual(['capsule', 'capsule', recipe]);
		expect(modules(draw(new Map([...frame.state.parts].reverse())))).toEqual(first);
		const reordered = new Map([...frame.state.parts].sort(([a], [b]) => a.localeCompare(b)));
		expect(modules(draw(reordered))).toEqual(first);
	}
});

test('a rejected ten-roof docking survey remains bounded', async () => {
	const hardware = await import('../megastructure');
	const world = createWorld(7);
	const ids = Array.from({ length: 10 }, (_, i) => 30 + 2 * i + '/40');
	const town = withState(world, {
		...world.state,
		stacks: new Map(ids.map((id) => [id, ['living'] as const]))
	});
	const stroke = (w: typeof town, style: 'totem' | 'megastructure') =>
		ids.reduce(extendStroke, beginStroke({ kind: 'house', use: 'water', style }, w));
	const frame = stroke(town, 'megastructure');
	expect(frame.failure).toBeUndefined();
	const probe = spyOn(hardware, 'dockModule');
	try {
		const result = [ids[0], ids[9]].reduce(
			extendStroke,
			beginStroke({ kind: 'house', use: 'water', style: 'totem' }, frame.draft)
		);
		expect(result.failure?.reason).toBe('no-dock-group');
		expect(probe.mock.calls.length).toBeGreaterThan(0);
		// Two stroke extensions, including the preferred and fallback fitting surveys.
		expect(probe.mock.calls.length).toBeLessThanOrEqual(1024 * 2);
	} finally {
		probe.mockRestore();
	}
});
