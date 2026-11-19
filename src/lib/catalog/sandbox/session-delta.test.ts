// @ts-expect-error Bun provides these test APIs at runtime.
import { expect, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import { sandboxGenerationYears } from '../data/sandbox';
import * as sandbox from '../logic/sandbox';
import {
	openingScene,
	planStroke,
	strokeDelta,
	traceStroke,
	type Tool,
	type World
} from '../logic/sandbox';
import * as terrainGrid from '../logic/terrain-grid';
import { placementResponse, type Completion, type StrokeRelease } from './feedback';
import { createSessionActions } from './session-actions';
import { createSandboxSound } from './sound';

const { world: opening } = openingScene(7);
const house = { kind: 'house', use: 'living', style: 'collage' } as const;
const dig = { kind: 'dig' } as const;
const erase = { kind: 'erase' } as const;
const walkway = { kind: 'line', transit: 'walkway' } as const;
const viaduct = { kind: 'line', transit: 'viaduct' } as const;

function traced(base: World, tool: Tool, from: string, to = from) {
	const start = traceStroke(base.grid, { cellIds: [], lastPointerCellId: undefined }, from);
	return planStroke(base, tool, traceStroke(base.grid, start, to).cellIds);
}

function session() {
	const events: Completion[] = [];
	const actions = createSessionActions(opening, sandboxGenerationYears, () => {});
	actions.onCompletion((event) => events.push(event));
	const world = () => actions.snapshot().world;
	const commit = (plan: StrokeRelease) => {
		expect(actions.release(plan)).toBe(true);
		actions.commitRelease(plan);
	};
	return { actions, events, world, commit };
}

for (const [use, tool, from, to] of [
	['material', walkway, '30/35', '35/37'],
	['living', house, '81/44', '81/44']
] as const) {
	test(`${tool.kind} cannot consume a ${use} unit that the preview did not debit`, () => {
		const { actions, events, world, commit } = session();
		commit(traced(world(), { ...house, use }, '80/44'));
		const base = world();
		const returnStock = traced(base, erase, '80/44');
		const build = traced(base, tool, from, to);
		expect(build.outcome().draft.state.store[use]).toBe(base.state.store[use]);
		actions.release(returnStock);
		actions.release(build);
		actions.commitRelease(build);
		actions.commitRelease(returnStock);
		expect(world().state.store[use]).toBe(1);
		expect(events.map(({ kind }) => kind)).toEqual(['house', 'erase']);
		expect(world().state.stacks.has('81/44')).toBe(false);
		expect(world().state.parts.size).toBe(0);
		actions.undo();
		expect(world().state).toBe(base.state);
	});
}

for (const [tool, from, to] of [
	[house, '80/44', '80/44'],
	[walkway, '30/35', '35/37'],
	[viaduct, '87/35', '96/35']
] as const) {
	test(`a ${tool.kind === 'house' ? 'Body' : tool.transit} surveyed in 2026 is discarded in 2051`, () => {
		const { actions, events, world, commit } = session();
		const preview = traced(world(), tool, from, to);
		expect(preview.outcome().draft).not.toBe(opening);
		actions.advance();
		const advanced = world();
		commit(preview);
		expect(world()).toBe(advanced);
		expect(events.map(({ kind }) => kind)).toEqual(['advance']);
		actions.undo();
		expect(world().state).toBe(opening.state);
	});
}

test('a held dig after an unrelated placement reuses one terrain derivation at commit', () => {
	const { actions, events, world, commit } = session();
	const preview = traced(world(), dig, '76/41');
	expect(sandbox.previewStrokePlan(preview)).toHaveLength(2);
	commit(traced(world(), house, '81/44'));
	expect(actions.release(preview)).toBe(true);
	const planner = spyOn(sandbox, 'planStroke');
	const grid = spyOn(terrainGrid, 'regrid');
	try {
		actions.commitRelease(preview);
		actions.commitRelease(preview);
		expect(planner).toHaveBeenCalledTimes(1);
		expect(grid).toHaveBeenCalledTimes(1);
	} finally {
		grid.mockRestore();
		planner.mockRestore();
	}
	const event = events.at(-1);
	assert.ok(event);
	expect(event.kind).toBe('dig');
	expect(strokeDelta(event.before, event.after)).toBe(
		strokeDelta(preview.base, preview.outcome().draft)
	);
	expect(world().state.store.living).toBe(30);
});

for (const terrainChanges of ['before release', 'after release'] as const) {
	test(`a dig replans once when another basin commits ${terrainChanges}`, () => {
		const { actions, events, world } = session();
		const preview = traced(world(), dig, '76/41');
		const earlier = traced(world(), dig, '22/35');
		actions.release(earlier);
		if (terrainChanges === 'before release') actions.commitRelease(earlier);
		actions.release(preview);
		if (terrainChanges === 'after release') actions.commitRelease(earlier);
		const planner = spyOn(sandbox, 'planStroke');
		const grid = spyOn(terrainGrid, 'regrid');
		try {
			actions.commitRelease(preview);
			expect(planner).toHaveBeenCalledTimes(1);
			expect(grid).toHaveBeenCalledTimes(1);
		} finally {
			grid.mockRestore();
			planner.mockRestore();
		}
		expect(events.map(({ kind }) => kind)).toEqual(['dig', 'dig']);
		expect(world().state.edits).toHaveLength(2);
	});
}

test('a multi-cell dig settles all surveyed basins through one regrid', () => {
	const { actions, world } = session();
	const preview = traced(world(), dig, '87/35', '90/38');
	const grid = spyOn(terrainGrid, 'regrid');
	try {
		actions.release(preview);
		actions.commitRelease(preview);
		expect(grid).toHaveBeenCalledTimes(1);
	} finally {
		grid.mockRestore();
	}
	expect(world().state.edits).toHaveLength(7);
});

function placementSignals(actions: ReturnType<typeof createSessionActions>) {
	const starts: number[] = [];
	const animations: Completion['kind'][] = [];
	const node = {
		connect() {
			return this;
		},
		disconnect() {},
		start(at: number) {
			starts.push(at);
		},
		stop() {},
		frequency: { value: 0 },
		gain: {
			value: 0,
			setValueAtTime() {},
			exponentialRampToValueAtTime() {}
		}
	};
	class AudioProbe {
		destination = node;
		currentTime = 0;
		createGain = () => node;
		createOscillator = () => node;
		resume = async () => {};
	}
	const globals = ['AudioContext', 'document'] as const;
	const previous = globals.map((key) => Object.getOwnPropertyDescriptor(globalThis, key));
	Object.assign(globalThis, { AudioContext: AudioProbe, document: { hidden: false } });
	const sound = createSandboxSound();
	sound.unlock();
	const unsubscribe = actions.onCompletion((event) => {
		if (event.kind !== 'line') return;
		sound.play(event);
		const response = placementResponse(event, {
			metersPerPixel: () => 1,
			project: ([x, y]) => ({ x, y })
		});
		if (response) animations.push(response.kind);
	});
	return {
		starts,
		animations,
		dispose() {
			unsubscribe();
			for (const [i, key] of globals.entries()) {
				if (previous[i]) Object.defineProperty(globalThis, key, previous[i]);
				else Reflect.deleteProperty(globalThis, key);
			}
		}
	};
}

test('a discarded walkway gives no placement sound, animation, or history entry', () => {
	const { actions, world, commit } = session();
	const stale = traced(world(), walkway, '30/35', '35/37');
	const signals = placementSignals(actions);
	try {
		const basin = traced(world(), dig, '22/35');
		actions.release(basin);
		actions.release(stale);
		actions.commitRelease(stale);
		actions.commitRelease(basin);
		expect(signals.starts).toEqual([]);
		expect(signals.animations).toEqual([]);
		expect(world().state.parts.size).toBe(0);
		actions.undo();
		expect(world().state).toBe(opening.state);

		const fresh = traced(world(), walkway, '30/35', '35/37');
		commit(fresh);
		expect(signals.starts).toHaveLength(1);
		expect(signals.animations).toEqual(['line']);
	} finally {
		signals.dispose();
	}
});

test('random interleavings commit exactly the previewed delta or leave the world untouched', () => {
	const samples = [
		[house, '80/44', '81/44'],
		[house, '75/38', '75/38'],
		[{ ...house, use: 'material' } as const, '82/44', '82/44'],
		[erase, '80/44', '82/44'],
		[dig, '76/41', '76/41'],
		[dig, '22/35', '22/35'],
		[walkway, '30/35', '35/37'],
		[viaduct, '87/35', '96/35'],
		[{ kind: 'cover', cover: 'meadow' } as const, '81/44', '82/44']
	] as const;
	let accepted = 0;
	let discarded = 0;
	for (const seed of [103, 491, 2026]) {
		const { actions, events, world, commit } = session();
		const intervening = [
			actions.advance,
			actions.undo,
			actions.redo,
			() => commit(traced(world(), erase, '80/44', '82/44')),
			() => commit(traced(world(), house, '80/44')),
			() => commit(traced(world(), dig, '76/41'))
		];
		let state = seed;
		const pick = (size: number) => {
			state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
			return Math.floor((state / 0x100000000) * size);
		};
		for (let i = 0; i < 18; i++) {
			const [tool, from, to] = samples[pick(samples.length)];
			const preview = traced(world(), tool, from, to);
			const expected = strokeDelta(preview.base, preview.outcome().draft);
			intervening[pick(intervening.length)]();
			const before = world();
			const candidates = planStroke(before, preview.tool, preview.cellIds);
			const candidate = candidates.outcome().draft;
			const eventCount = events.length;
			const canUndo = actions.snapshot().canUndo;
			commit(preview);
			if (candidate !== before && expected === strokeDelta(before, candidate)) {
				accepted++;
				expect(events.length).toBe(eventCount + 1);
				const actual = events[eventCount];
				expect(actual.before).toBe(before);
				expect(actual.after).toBe(world());
				expect(strokeDelta(actual.before, actual.after)).toBe(expected);
			} else {
				discarded++;
				expect(events.length).toBe(eventCount);
				expect(world()).toBe(before);
				expect(actions.snapshot().canUndo).toBe(canUndo);
			}
		}
	}
	expect(accepted).toBeGreaterThan(0);
	expect(discarded).toBeGreaterThan(0);
}, 20000);
