// @ts-expect-error Bun provides this test API at runtime.
import { expect, test } from 'bun:test';
import { sandboxGenerationYears } from '../data/sandbox';
import { applyStroke, openingScene, planStroke } from '../logic/sandbox';
import { storedModules, type Completion, type StrokeRelease } from './feedback';
import { createSessionActions } from './session-actions';

const { world } = openingScene(7);
const stroke = (cellId: string, base = world): StrokeRelease =>
	planStroke(base, { kind: 'house', style: 'collage', use: 'living' }, [cellId]);

test('Undo just after releasing B leaves A, and Redo restores B', () => {
	const actions = createSessionActions(world, sandboxGenerationYears, () => {});
	const a = stroke('80/44');
	actions.release(a);
	actions.commitRelease(a);
	const baseB = actions.snapshot().world;
	const afterA = baseB.state;
	const b = stroke('81/44', baseB);
	actions.release(b);
	actions.undo();
	expect(actions.snapshot().world.state).toBe(afterA);
	actions.commitRelease(b);
	expect(actions.snapshot().world.state).toBe(afterA);
	expect(actions.snapshot().canRedo).toBe(true);
	actions.redo();
	const afterB = actions.snapshot().world.state;
	expect(afterB.stacks.get('80/44')).toEqual(['living']);
	expect(afterB.stacks.get('81/44')).toEqual(['living']);
	expect(afterB.nextAction).toBe(afterA.nextAction + 1);
});

const dig = planStroke(world, { kind: 'dig' }, ['76/41']);

test('New terrain waits for its earlier stroke and rejects a later dig on the old seed', () => {
	const actions = createSessionActions(world, sandboxGenerationYears, () => {});
	const commits: number[] = [];
	actions.onCompletion(({ after }) => commits.push(after.seed));
	const a = stroke('80/44');
	expect(actions.release(a)).toBe(true);
	actions.restart();
	expect(actions.snapshot().world).toBe(world);
	expect(actions.release(dig)).toBe(false);
	actions.commitRelease(dig);
	expect(actions.snapshot().world).toBe(world);
	actions.commitRelease(a);
	expect(commits).toEqual([7]);
	const fresh = openingScene(8).world;
	expect(actions.snapshot().world.seed).toBe(8);
	expect(actions.snapshot().world.state).toEqual(fresh.state);
	expect(actions.release(dig)).toBe(false);
	actions.commitRelease(dig);
	expect(actions.snapshot().world.state).toEqual(fresh.state);
	expect(actions.snapshot().canUndo).toBe(false);
});

test('a queued stroke cannot build on a target changed by an earlier stroke', () => {
	const actions = createSessionActions(world, sandboxGenerationYears, () => {});
	const a = stroke('80/44');
	const b = stroke('80/44');
	actions.release(a);
	expect(actions.release(b)).toBe(true);
	actions.commitRelease(b);
	expect(actions.snapshot().world).toBe(world);
	actions.commitRelease(a);
	expect(actions.snapshot().world.state.stacks.get('80/44')).toEqual(['living']);
	expect(actions.release(b)).toBe(true);
	actions.commitRelease(b);
	expect(actions.snapshot().world.state.stacks.get('80/44')).toEqual(['living']);
	actions.undo();
	expect(actions.snapshot().world.state).toBe(world.state);
});

test('a basin invalidates a changed house plan and preserves the inland plan', () => {
	const actions = createSessionActions(world, sandboxGenerationYears, () => {});
	// Only living stock is replenished by this basin. Keep the stock debit fixed in this geometry test.
	const tool = { kind: 'house', style: 'collage', use: 'water' } as const;
	const raisedBank = planStroke(world, tool, ['75/38']);
	const inland = planStroke(world, tool, ['81/44']);
	const dug = applyStroke(world, dig.tool, dig.cellIds).draft;
	expect(dug.grid.cellsById.get('75/38')?.buildable).toBe(true);
	expect(dug.grid.cellsById.get('75/38')).not.toBe(world.grid.cellsById.get('75/38'));
	expect(dug.state.stacks.get('75/38')).toBe(world.state.stacks.get('75/38'));
	actions.release(dig);
	actions.release(raisedBank);
	actions.release(inland);
	actions.commitRelease(raisedBank);
	actions.commitRelease(inland);
	actions.commitRelease(dig);
	expect(actions.snapshot().world.state.stacks.get('75/38')).toBeUndefined();
	expect(actions.snapshot().world.state.stacks.get('81/44')).toEqual(['water']);
	expect(actions.snapshot().world.state.edits).toEqual(dug.state.edits);
});

test('repeated New terrain requests resolve to successive seeds behind a paused stroke', () => {
	const actions = createSessionActions(world, sandboxGenerationYears, () => {});
	const a = stroke('80/44');
	actions.release(a);
	actions.restart();
	actions.restart();
	expect(actions.snapshot().world.seed).toBe(7);
	actions.commitRelease(a);
	expect(actions.snapshot().world.seed).toBe(9);
	expect(actions.snapshot().world.state).toEqual(openingScene(9).world.state);
});

test('dig delivers its store flight and follow-up sound before a queued Advance', () => {
	const actions = createSessionActions(world, sandboxGenerationYears, () => {});
	const feedback: string[] = [];
	actions.onCompletion((value) => {
		if (value.kind === 'dig') feedback.push(`flight:${storedModules(value).length}`);
	});
	actions.onCompletion(({ kind }) => feedback.push(`sound:${kind}`));
	actions.release(dig);
	actions.advance();
	expect(feedback).toEqual([]);
	actions.commitRelease(dig);
	expect(feedback).toEqual(['flight:30', 'sound:dig', 'sound:advance']);
	const after = actions.snapshot().world.state;
	expect(after.year).toBe(world.state.year + sandboxGenerationYears);
	expect(after.store.living - world.state.store.living).toBe(30);
	actions.undo();
	expect(actions.snapshot().world.state.year).toBe(world.state.year);
	expect(actions.snapshot().world.state.store).toEqual(after.store);
	actions.undo();
	expect(actions.snapshot().world.state).toBe(world.state);
});

test('Advance just after release runs once and the stroke keeps its earlier year', () => {
	const actions = createSessionActions(world, sandboxGenerationYears, () => {});
	const a = stroke('80/44');
	const year = world.state.year;
	actions.release(a);
	actions.advance();
	expect(actions.snapshot().world.state).toBe(world.state);
	actions.commitRelease(a);
	const advanced = actions.snapshot().world.state;
	expect(advanced.year).toBe(year + sandboxGenerationYears);
	expect(advanced.storyParts.get('80/44')?.at(-1)?.built).toBe(year);
	expect(advanced.nextAction).toBe(world.state.nextAction + 1);
	actions.undo();
	const placed = actions.snapshot().world.state;
	expect(placed.year).toBe(year);
	expect(placed.stacks.get('80/44')).toEqual(['living']);
});

test('all completion listeners receive the same events before a listener-enqueued edit runs', () => {
	const actions = createSessionActions(world, sandboxGenerationYears, () => {});
	const records: Completion[][] = [[], [], []];
	actions.onCompletion((event) => records[0].push(event));
	actions.onCompletion((event) => {
		records[1].push(event);
		if (event.kind === 'house') {
			actions.advance();
			expect(actions.snapshot().world).toBe(event.after);
		}
	});
	actions.onCompletion((event) => records[2].push(event));
	const a = stroke('80/44');
	actions.release(a);
	actions.commitRelease(a);
	actions.commitRelease(a);
	for (const events of records) {
		expect(events.map(({ kind }) => kind)).toEqual(['house', 'advance']);
		expect(events[0]).toBe(records[0][0]);
		expect(events[1]).toBe(records[0][1]);
		expect(events[0].after).toBe(events[1].before);
	}
	expect(actions.snapshot().world.state.year).toBe(world.state.year + sandboxGenerationYears);
});
