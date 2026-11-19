import { createHash } from 'node:crypto';
import { expect, test } from 'bun:test';
import { createTerrain } from '../terrain';
import { deriveGrid } from '../terrain-grid';
import {
	EMPTY_STATE,
	advanceAdditions,
	applyEdit,
	installationView,
	openingScene,
	runFrameTimeline,
	setFutureTarget,
	spongeWorkView,
	withState,
	type World
} from './index';
import { frameIntent } from './frame-intent';

// Seed 7 before P5c, with Map insertion order preserved in the encoding.
const baseline = [
	'7dbf6fcd2217e2018c5f3fb9d9e9795f1f205f5125420fac96f984c016333396',
	'cb067cb126fe8d42872c92371ac099e92a4e9db1767a71fa51f63e1572c8d6ad',
	'0255a2c1014a6f7dd9486af76249b2dee75559aa9256f2907e658d6d5b61f267',
	'efd7b078a6e57dc0ff670bb88cb6d910d512908329c635936106c0debdf8ba27',
	'fc0e482185a6a70e384cc75591d77de7fb89046b1295d14a9729314fefdf46b1'
];

function encode(world: World) {
	return JSON.stringify(world.state, (_, value: unknown) =>
		value instanceof Map ? [...value.entries()] : value
	);
}

function start() {
	const seed = 7;
	const grid = deriveGrid({ ...createTerrain({ seed }), along: 100, across: 100 });
	const houses = grid.cells.filter((cell) => cell.buildable && (cell.column + cell.row) % 3 !== 0);
	const stacks = new Map(houses.map((cell) => [cell.id, ['living'] as const]));
	const world: World = { grid, seed, state: { ...EMPTY_STATE, stacks }, lines: [] };
	return frameIntent(
		world,
		houses.slice(0, 2).map(({ id }) => id)
	).draft;
}

function tanks(world: World) {
	return [...world.state.parts.values()]
		.filter((p) => p.kind === 'module')
		.filter((p) => p.recipe === 'tank');
}

test('four default ticks reproduce the original state bytes and ordering', () => {
	const world = start();
	expect(setFutureTarget(world)).toBe(world);
	const { checkpoints } = runFrameTimeline(world, 4, undefined, 1);
	expect(checkpoints.map((w) => createHash('sha256').update(encode(w)).digest('hex'))).toEqual(
		baseline
	);
});

test('switching after tick one adds framed tanks only to new bays over four ticks', () => {
	const world = start();
	const off = runFrameTimeline(world, 4, undefined, 1).checkpoints;
	const prefix = runFrameTimeline(world, 1, undefined, 1).checkpoints;
	const atSwitch = setFutureTarget(prefix[1], 'sponge-city');
	const after = runFrameTimeline(atSwitch, 3, undefined, 1).checkpoints.slice(1);
	const on = [...prefix, ...after];

	expect(on.slice(0, 2).map(encode)).toEqual(off.slice(0, 2).map(encode));
	expect(atSwitch.state.stacks).toBe(prefix[1].state.stacks);
	expect(atSwitch.state.parts).toBe(prefix[1].state.parts);
	expect(on[4].state.stacks).toBe(world.state.stacks);
	expect(tanks(on[4]).length).toBeGreaterThan(tanks(off[4]).length);
	const forms = installationView(on[4], 'all');

	for (const tank of tanks(on[4])) {
		expect(tank.built).toBeGreaterThan(atSwitch.state.year);
		expect(
			forms.find((form) => form.id.startsWith(tank.id + '/') && form.kind === 'sphere')
		).toMatchObject({ role: 'neu' });
		const support = on[4].state.parts.get(tank.attachedTo);
		expect(support?.built).toBe(tank.built);
	}
});

test('replaying the target from the same checkpoint produces identical additions', () => {
	const tick = runFrameTimeline(start(), 1, undefined, 1).checkpoints[1];
	const active = setFutureTarget(tick, 'sponge-city');
	expect(setFutureTarget(active, 'sponge-city')).toBe(active);
	const next = () => runFrameTimeline(active, 3, undefined, 1).checkpoints.map(encode);
	expect(next()).toEqual(next());
	expect(encode(setFutureTarget(active))).toBe(encode(tick));
});

test('switching off preserves the fitted tanks and their supports on later ticks', () => {
	const tick = runFrameTimeline(start(), 1, undefined, 1).checkpoints[1];
	const built = runFrameTimeline(setFutureTarget(tick, 'sponge-city'), 1, undefined, 1)
		.checkpoints[1];
	const disabled = setFutureTarget(built);
	expect(disabled.state.parts).toBe(built.state.parts);
	const later = runFrameTimeline(disabled, 2, undefined, 1).checkpoints[2];
	expect(tanks(built).length).toBeGreaterThan(0);
	expect(tanks(later)).toEqual(tanks(built));
	expect(later.state.spongeWorks).toBe(built.state.spongeWorks);
	for (const [id, part] of built.state.parts) expect(later.state.parts.get(id)).toBe(part);
});

test('seed 7 adds four differently shaped, permanent catchment works per tick and replays them', () => {
	const base = openingScene(7).world;
	const start = setFutureTarget(base, 'sponge-city');
	const sequence = () => runFrameTimeline(start, 3).checkpoints;
	const worlds = sequence();
	const replay = sequence();
	const works = (world: World) => world.state.spongeWorks ?? [];
	const forms = (world: World) => works(world).map((work) => spongeWorkView(world.grid, work));
	expect(worlds.map((world) => works(world).length)).toEqual([0, 4, 8, 12]);
	expect(replay.map(forms)).toEqual(worlds.map(forms));
	for (let i = 1; i < worlds.length; i++) {
		const [before, after] = [worlds[i - 1], worlds[i]];
		const added = works(after).slice(works(before).length);
		expect(works(after).slice(0, works(before).length)).toEqual([...works(before)]);
		expect(forms(after).slice(0, works(before).length)).toEqual(forms(before));
		expect(added.map(({ kind }) => kind)).toEqual([
			'tank',
			'retention-basin',
			'green-roof',
			'water-square'
		]);
		expect(added.every(({ built }) => built === after.state.year)).toBe(true);
		expect(
			forms(after).every((parts) =>
				parts.some(({ token, role }) => token.startsWith('--cat-') && role === 'neu')
			)
		).toBe(true);
		expect(advanceAdditions(before, after)).toMatchObject({
			'retention-basin': 1,
			'green-roof': 1,
			'water-square': 1
		});
	}
	const restored = withState(worlds[3], worlds[1].state);
	expect(forms(restored)).toEqual(forms(worlds[1]));
	const invalid = applyEdit(worlds[3], { kind: 'advance', years: 0 });
	expect(invalid).toBe(worlds[3]);
});
