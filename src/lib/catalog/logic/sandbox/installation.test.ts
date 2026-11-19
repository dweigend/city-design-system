import { savedCarrier } from './fixtures/saved-carrier.fixture.test';
import { expect, test } from 'bun:test';
import {
	installationView,
	applyEdit,
	beginStroke,
	commit,
	createWorld,
	extendStroke,
	startHistory,
	undo,
	withState
} from './index';

const town = createWorld(7);
const roofs = ['30/40', '32/40', '34/40'];
const base = withState(town, {
	...town.state,
	year: 2027,
	stacks: new Map(roofs.map((id) => [id, ['living'] as const]))
});
const carrier = (ids: string[], world = base, style: 'megastructure' | 'totem' = 'megastructure') =>
	ids.reduce(extendStroke, beginStroke({ kind: 'house', use: 'water', style }, world));
test('one stroke records one reversible frame goal across the painted houses', () => {
	const built = carrier(roofs).draft.state;
	expect(built.frameTimeline?.goals).toHaveLength(1);
	expect(built.parts).toBe(base.state.parts);
	expect(undo(commit(startHistory(base.state), built)).present).toBe(base.state);
});
test('a disconnected stroke retains the frame goal without installing a span', () => {
	const ids = ['30/40', '50/40'];
	const w = withState(base, {
		...base.state,
		stacks: new Map(ids.map((id) => [id, ['living'] as const]))
	});
	const stroke = carrier(ids, w);
	expect(stroke.draft.state.frameTimeline?.goals).toHaveLength(1);
	expect(stroke.draft.state.parts).toBe(w.state.parts);
});
test('totem without a supporting carrier leaves the survey intact', () => {
	const w = withState(base, { ...base.state, year: 2028 });
	const stroke = carrier(roofs, w, 'totem');
	expect(stroke.draft).toBe(w);
	expect(stroke.failure?.reason).toBe('no-dock-group');
});
test('a short walkway cannot leave an isolated landing', () => {
	const stroke = extendStroke(beginStroke({ kind: 'line', transit: 'walkway' }, base), roofs[0]);
	expect(stroke.draft).toBe(base);
	expect(stroke.failure?.reason).toBe('short-span');
});

test('two neutral shells and one colored module touch their carrier and undo together', () => {
	const frame = savedCarrier(withState(town, { ...town.state, year: 2027 }), '83/47');
	const w = withState(frame, { ...frame.state, year: 2028 });
	for (const use of ['energy', 'water'] as const) {
		const group = ['83/47', '87/47'].reduce(
			extendStroke,
			beginStroke({ kind: 'house', use, style: 'totem' }, w)
		).draft;
		const modules = [...group.state.parts.values()].filter((p) => p.kind === 'module');
		expect(modules.map((p) => p.recipe)).toEqual([
			'capsule',
			'capsule',
			use === 'water' ? 'tank' : 'solar-ring'
		]);
		const view = installationView(group, 'all');
		expect(view.filter((p) => p.kind === 'capsule')).toHaveLength(3);
		const top = view.at(-1);
		expect(top?.token).toBe(use === 'water' ? '--cat-health' : '--cat-mobility');
		if (top?.kind === 'sphere') {
			expect(top.radius).toBe(1);
			const rod = view.find((p) => p.id === modules[2].attachedTo);
			if (rod?.kind !== 'pipe') throw new Error('Missing chord');
			expect(top.position[2] - top.radius).toBeCloseTo(rod.points[0][2] + rod.radius, 9);
		}
		expect(undo(commit(startHistory(w.state), group.state)).present).toBe(w.state);
	}
});
test('a surveyed walkway has supported decks, stairs and a square at both ends', () => {
	const built = ['30/35', '35/37'].reduce(
		extendStroke,
		beginStroke({ kind: 'line', transit: 'walkway' }, town)
	).draft;
	const parts = [...built.state.parts.values()];
	expect(parts.filter((p) => p.recipe === 'plaza')).toHaveLength(2);
	expect(parts.filter((p) => p.kind === 'pillar').length).toBe(
		parts.filter((p) => p.recipe === 'walkway').length + 1
	);
	expect(installationView(built, 'all').some((p) => p.id.includes(':tread:'))).toBe(true);
});

test('a walkway crossing three blocks in a straight line leaves the state intact', () => {
	const stroke = ['30/46', '58/46'].reduce(
		extendStroke,
		beginStroke({ kind: 'line', transit: 'walkway' }, town)
	);
	expect(stroke.failure?.reason).toBe('straight-three-blocks');
	expect(stroke.draft).toBe(town);
});

const walkwayIds = ['30/35', '35/37'];
const walkway = (world: typeof town) =>
	walkwayIds.reduce(extendStroke, beginStroke({ kind: 'line', transit: 'walkway' }, world));
test('a repeat cannot reserve the same path twice', () => {
	const built = walkway(town).draft;
	expect(walkway(built).failure?.reason).toBe('occupied-path');
	expect(walkway(built).draft).toBe(built);
});
for (const material of [0, 3, 100]) {
	test('eraser and regrid each restore the recorded stock debit from ' + material, () => {
		const start = withState(town, { ...town.state, store: { ...town.state.store, material } });
		const built = walkway(start).draft;
		const cost = [...built.state.parts.values()].reduce((n, p) => n + p.materials.material, 0);
		expect(built.state.parts.size).toBeGreaterThan(3);
		expect(cost).toBe(Math.min(built.state.parts.size, material));
		expect(built.state.store.material).toBe(material - cost);
		for (const kind of ['clear', 'dig'] as const) {
			const removed = applyEdit(built, { kind, cellId: walkwayIds[0] });
			expect(removed.state.store.material).toBe(material);
			expect(removed.state.compositions.size).toBe(0);
			expect(installationView(removed, 'all')).toEqual([]);
			expect(undo(commit(startHistory(built.state), removed.state)).present).toBe(built.state);
		}
	});
}
test('explicit building methods override the date for both frame and docking', () => {
	const ids = ['83/47', '87/47'];
	const build = (style: 'megastructure' | 'totem', w: typeof town) =>
		ids.reduce(extendStroke, beginStroke({ kind: 'house', use: 'water', style }, w)).draft;
	const frame = build('megastructure', town);
	expect(frame.state.year).toBe(town.state.year);
	expect(frame.state.frameTimeline?.goals.length).toBe(1);
	expect(
		[...build('totem', savedCarrier(frame, ids[0])).state.parts.values()].filter(
			(p) => p.kind === 'module'
		)
	).toHaveLength(3);
});
test('previous-format worlds project an empty installation layer', () => {
	const { parts, compositions, ...legacy } = town.state;
	expect(installationView(withState(town, legacy), 'all')).toEqual([]);
	expect(parts.size + compositions.size).toBe(0);
});

test('a wall bearing follows the inset lot along the alley at 89/41', () => {
	const id = '89/41';
	const cell = town.grid.cellsById.get(id);
	if (!cell?.lotCorners) throw new Error('Expected a lot along a public alley');
	const world = savedCarrier(town, id, 'water');
	const foot = [...world.state.parts.values()].find(
		(p) => p.recipe === 'bearing' && p.anchor.face === 1
	);
	if (!foot) throw new Error('Missing alley wall bearing');
	const dot = installationView(world, 'all').find((p) => p.id === foot.id + '/joint');
	if (dot?.kind !== 'sphere') throw new Error('Missing bearing point');
	const [a, b] = cell.lotCorners.slice(1, 3);
	const dx = b[0] - a[0],
		dy = b[1] - a[1],
		length = Math.hypot(dx, dy);
	const offset = foot.anchor.inset ?? 0;
	expect(dot.position[0]).toBeCloseTo((a[0] + b[0]) / 2 - (offset * dy) / length, 8);
	expect(dot.position[1]).toBeCloseTo((a[1] + b[1]) / 2 + (offset * dx) / length, 8);
	expect([a, b]).not.toEqual(cell.corners.slice(1, 3));
});

test('same-year carrier and capsules retain their selected flows on the timeline', () => {
	const ids = ['83/47', '87/47'];
	const frame = savedCarrier(town, ids[0]);
	const group = ids.reduce(
		extendStroke,
		beginStroke({ kind: 'house', style: 'totem', use: 'water' }, frame)
	).draft;
	const aged = applyEdit(group, { kind: 'advance' });
	expect(aged.state.timeLayers.find((layer) => layer.year === 2026)?.flows).toEqual([
		'material',
		'water'
	]);
	const installed = installationView(group, 'all');
	const capsules = installed.filter((part) => part.kind === 'capsule');
	expect(capsules).toHaveLength(3);
	expect(installed.some(({ role, token }) => role === 'neu' && token === '--cat-health')).toBe(
		true
	);
	expect(installationView(aged, 'all')).toEqual(installed);
	const old = withState(town, { ...town.state, year: 1900 });
	expect(
		ids.reduce(
			extendStroke,
			beginStroke({ kind: 'house', style: 'megastructure', use: 'water' }, old)
		).draft
	).toBe(old);
});
