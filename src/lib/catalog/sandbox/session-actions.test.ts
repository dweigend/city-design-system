// @ts-expect-error Bun provides this test API at runtime.
import { expect, test } from 'bun:test';
import { sandboxGenerationYears } from '../data/sandbox';
import { openingScene } from '../logic/sandbox';
import type { StrokeRelease } from './feedback';
import { createSessionActions } from './session-actions';

const { world } = openingScene(7);
const stroke = (cellId: string): StrokeRelease => ({
	tool: { kind: 'house', style: 'collage', use: 'living' },
	cellIds: [cellId]
});

test('Undo just after releasing B leaves A, and Redo restores B', () => {
	const actions = createSessionActions(world, sandboxGenerationYears, () => {});
	const a = stroke('80/44');
	const b = stroke('81/44');
	actions.release(a);
	actions.commitRelease(a);
	const afterA = actions.snapshot().world.state;
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
