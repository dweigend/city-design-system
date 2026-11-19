// @ts-expect-error Bun provides these APIs at runtime.
import { expect, test } from 'bun:test';
// @ts-expect-error The app has no Bun runtime dependency.
import { plugin, file } from 'bun';
import { compileModule } from 'svelte/compiler';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { applyStroke, strokePreview } from '../logic/sandbox';
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
	const gesture = session.gesture!;
	const preview = strokePreview(gesture.base, gesture.tool, gesture.cellIds);
	expect(preview.length).toBeGreaterThan(0);
	if (change === 'tool') session.tool = { kind: 'dig' };
	if (change === 'method') session.pickMethod('megastructure');
	if (change === 'option') session.tool = { kind: 'house', use: 'water' };
	const held = session.gesture!;
	expect(held).toBe(gesture);
	expect(strokePreview(held.base, held.tool, held.cellIds)).toEqual(preview);
	const release = session.strokeRelease()!;
	expect(release).toBe(gesture);
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
			const first = session.strokeRelease()!;
			if (timing === 'before') session.commitRelease(first);

			// A held gesture keeps the projection it began on when the first commit lands.
			session.strokeStart(session.world, '81/44');
			if (timing === 'during') session.commitRelease(first);
			if (gesture === 'drag') session.strokeMove('82/44');
			const second = session.strokeRelease()!;
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
