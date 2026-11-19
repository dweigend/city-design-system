// @ts-expect-error Bun provides these APIs at runtime.
import { expect, spyOn, test } from 'bun:test';
// @ts-expect-error The app has no Bun runtime dependency.
import { plugin, file } from 'bun';
import { compileModule } from 'svelte/compiler';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import assert from 'node:assert/strict';
import * as sandbox from '../logic/sandbox';
import { applyStroke, previewStrokePlan } from '../logic/sandbox';
import type { Completion } from './feedback';

plugin({
	name: 'sandbox-session-runes',
	setup(build: {
		onLoad: (
			filter: { filter: RegExp },
			load: (input: { path: string }) => Promise<unknown>
		) => void;
	}) {
		build.onLoad({ filter: /\/session\.svelte\.ts$/ }, async ({ path }) => {
			const source: string = await file(path).text();
			const { outputText } = transpileModule(source, {
				compilerOptions: {
					target: ScriptTarget.ESNext,
					module: ModuleKind.ESNext,
					verbatimModuleSyntax: true
				}
			});
			return {
				contents: compileModule(outputText, { filename: path, generate: 'client' }).js.code,
				loader: 'js'
			};
		});
	}
});

const { createSession } = await import('./session.svelte');

function place(change?: 'tool' | 'method' | 'option') {
	const session = createSession(7);
	session.advance();
	session.advance();
	session.advance();
	session.pickMethod('collage');
	const start = session.world;
	session.strokeStart(start, '80/44');
	const gesture = session.gesture;
	const plan = session.previewPlan;
	assert.ok(plan);
	const preview = previewStrokePlan(plan);
	expect(preview.length).toBeGreaterThan(0);
	if (change === 'tool') session.tool = { kind: 'dig' };
	if (change === 'method') session.pickMethod('megastructure');
	if (change === 'option') session.tool = { kind: 'house', use: 'water' };
	expect(session.gesture).toBe(gesture);
	expect(session.previewPlan).toBe(plan);
	expect(previewStrokePlan(plan)).toEqual(preview);
	const release = session.strokeRelease();
	assert.ok(release);
	expect(release).toBe(plan);
	expect(session.world).toBe(start);
	session.commitRelease(release);
	return session.world.state;
}

test('a held house preview and delayed placement keep their chosen tool and method', () => {
	const uninterrupted = place();
	expect(uninterrupted.storyParts.get('80/44')?.at(-1)?.style).toBe('collage');
	expect(place('tool')).toEqual(uninterrupted);
	expect(place('method')).toEqual(uninterrupted);
	expect(place('option')).toEqual(uninterrupted);
});

for (const gesture of ['tap', 'drag'] as const) {
	for (const timing of ['before', 'during', 'after'] as const) {
		test(`both edits enter history when the first tap commits ${timing} the second ${gesture}`, () => {
			const session = createSession(7);
			const opening = session.world;
			const events: Completion[] = [];
			session.onCompletion((event) => events.push(event));
			session.strokeStart(opening, '80/44');
			const first = session.strokeRelease();
			assert.ok(first);
			if (timing === 'before') session.commitRelease(first);

			// A held gesture keeps the projection it began on when the first commit lands.
			session.strokeStart(session.world, '81/44');
			if (timing === 'during') session.commitRelease(first);
			if (gesture === 'drag') session.strokeMove('82/44');
			const second = session.strokeRelease();
			assert.ok(second);
			const cellIds = gesture === 'drag' ? ['81/44', '82/44'] : ['81/44'];
			expect(second.cellIds).toEqual(cellIds);
			session.commitRelease(second);
			if (timing === 'after') {
				expect(events).toEqual([]);
				session.commitRelease(first);
			}

			expect(events.map(({ kind, cellIds }) => [kind, cellIds])).toEqual([
				['house', ['80/44']],
				['house', cellIds]
			]);
			const expectedFirst = applyStroke(opening, first.tool, first.cellIds).draft;
			const expectedBoth = applyStroke(expectedFirst, second.tool, cellIds).draft;
			expect(events[0].after.state).toEqual(expectedFirst.state);
			expect(events[1].before).toBe(events[0].after);
			const built = session.world.state;
			expect(built).toEqual(expectedBoth.state);
			session.undo();
			expect(session.world.state).toBe(events[0].after.state);
			session.undo();
			expect(session.world.state).toBe(opening.state);
			session.redo();
			expect(session.world.state).toBe(events[0].after.state);
			session.redo();
			expect(session.world.state).toBe(built);
		});
	}
}

const digScenarios = [
	{ name: 'changed approach', digCell: '22/35', house: false, undo: false },
	{ name: 'unchanged approach', digCell: '76/41', house: false, undo: false },
	{ name: 'Undo restores the house plot', digCell: '76/41', house: true, undo: true }
] as const;

const commitStages = [
	'before down',
	'after down',
	'after move',
	'after preview',
	'after release',
	'after ready'
] as const;

for (const scenario of digScenarios) {
	for (const stage of commitStages) {
		test(`${scenario.name}, Dig commits ${stage}`, () => {
			const session = createSession(7);
			const opening = session.world;
			const events: Completion[] = [];
			session.onCompletion((event) => events.push(event));
			session.tool = { kind: 'dig' };
			session.strokeStart(opening, scenario.digCell);
			const dig = session.strokeRelease();
			assert.ok(dig);
			if (scenario.undo) session.undo();
			const completeDigAt = (at: typeof stage) => {
				if (stage === at) session.commitRelease(dig);
			};
			completeDigAt('before down');

			const kind = scenario.house ? 'house' : 'line';
			session.tool = scenario.house
				? { kind: 'house', use: 'living' }
				: { kind: 'line', transit: 'walkway' };
			session.strokeStart(session.world, scenario.house ? '75/38' : '30/35');
			completeDigAt('after down');
			if (!scenario.house) session.strokeMove('35/37');
			completeDigAt('after move');
			const plan = session.previewPlan;
			assert.ok(plan);
			const marks = previewStrokePlan(plan);
			completeDigAt('after preview');
			const release = session.strokeRelease();
			assert.ok(release);
			expect(release).toBe(plan);

			const planning = spyOn(sandbox, 'planStroke');
			try {
				completeDigAt('after release');
				session.commitRelease(release);
				completeDigAt('after ready');
				session.commitRelease(release);
				const calls = planning.mock.calls.filter(
					([, tool]: Parameters<typeof sandbox.planStroke>) => tool.kind === kind
				);
				expect(calls).toHaveLength(1);
			} finally {
				planning.mockRestore();
			}

			const changed = scenario.digCell === '22/35';
			const fresh = stage === 'before down';
			const builds = !changed || fresh;
			expect(events.map((event) => event.kind)).toEqual(builds ? ['dig', kind] : ['dig']);
			if (scenario.house) {
				expect(session.world.state.stacks.get('75/38')).toEqual(['living']);
				expect(session.world.state.edits).toEqual([]);
				expect(marks).toHaveLength(6);
				session.undo();
				expect(session.world.state).toBe(opening.state);
			} else {
				expect(release.cellIds).toHaveLength(8);
				expect(marks).toHaveLength(changed && fresh ? 33 : 29);
				expect(session.world.state.parts.size).toBe(builds ? marks.length : 0);
			}
		});
	}
}

test('a house captured before a dig at its shared frontage keeps its original plot plan', () => {
	const session = createSession(7);
	const opening = session.world;
	session.tool = { kind: 'dig' };
	session.strokeStart(opening, '76/38');
	const dig = session.strokeRelease();
	assert.ok(dig);
	session.tool = { kind: 'house', use: 'living' };
	session.strokeStart(opening, '72/40');
	const house = session.strokeRelease();
	assert.ok(house);
	session.commitRelease(dig);
	const dug = session.world;
	expect(dug.grid.cellsById.get('72/40')).toBe(opening.grid.cellsById.get('72/40'));
	session.commitRelease(house);
	expect(session.world.state).toBe(dug.state);
});
