import { plugin, file } from 'bun';
import { compileModule } from 'svelte/compiler';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';

plugin({
	name: 'sandbox-session-runes',
	setup(build) {
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

export const { createSession } = await import('../session.svelte');
