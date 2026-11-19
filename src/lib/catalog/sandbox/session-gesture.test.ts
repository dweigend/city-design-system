// @ts-expect-error Bun provides these APIs at runtime.
import { expect, test } from 'bun:test';
// @ts-expect-error The app has no Bun runtime dependency.
import { plugin, file } from 'bun';
import { compileModule } from 'svelte/compiler';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { strokePreview } from '../logic/sandbox';

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
