import { describe, it as test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

function files(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
		e.isDirectory()
			? files(join(dir, e.name))
			: /\.(ts|svelte)$/.test(e.name) && !e.name.endsWith('.test.ts')
				? [join(dir, e.name)]
				: []
	);
}
function unbound(source: string): number {
	const scripts = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
	const code = scripts.length ? scripts.map((match) => match[1]).join('\n') : source;
	const tree = ts.createSourceFile('scene.ts', code, ts.ScriptTarget.Latest, true);
	let missing = 0;
	function visit(node: ts.Node) {
		if (
			ts.isNewExpression(node) &&
			/(?:^|\.)(?:WebGPU|WebGL)Renderer$/.test(node.expression.getText(tree))
		) {
			let owner: ts.Node | undefined = node.parent;
			while (owner && !ts.isFunctionLike(owner)) owner = owner.parent;
			const body = owner?.getText(tree) ?? '';
			if (
				!/const\s+stopTheme\s*=\s*bindSceneTheme\(canvas,\s*scene,\s*renderer,/.test(body) ||
				!/stopTheme\(\)/.test(body)
			)
				missing++;
		}
		ts.forEachChild(node, visit);
	}
	visit(tree);
	return missing;
}
describe('every renderer owns a live theme binding', () => {
	test('negative control: a new renderer without registration fails', () => {
		assert.equal(unbound('function create() { const renderer = new THREE.WebGPURenderer(); }'), 1);
	});
	test('registration in a different factory does not hide a missing binding', () => {
		assert.equal(
			unbound(
				'function a() { const stopTheme = bindSceneTheme(canvas, scene, renderer, cb); stopTheme(); } function b() { new WebGLRenderer(); }'
			),
			1
		);
	});
	test('registration must have a teardown', () => {
		assert.equal(
			unbound(
				'function create() { new WebGLRenderer(); const stopTheme = bindSceneTheme(canvas, scene, renderer, cb); }'
			),
			1
		);
	});
	test('bound renderer is accepted', () => {
		assert.equal(
			unbound(
				'function create() { new WebGLRenderer(); const stopTheme = bindSceneTheme(canvas, scene, renderer, cb); return { dispose() { stopTheme(); } }; }'
			),
			0
		);
	});
	test('a renderer hidden in a Svelte script is also rejected', () => {
		assert.equal(
			unbound(
				'<script lang="ts">onMount(() => { new THREE.WebGPURenderer(); });</script><canvas />'
			),
			1
		);
	});
	for (const file of files('src')) {
		test(file, () => {
			const source = readFileSync(file, 'utf8');
			assert.equal(unbound(source), 0);
			if (!file.includes('/theme/'))
				assert.doesNotMatch(source, /matchMedia\(['"]\(prefers-color-scheme/);
			if (file.includes('/data/') || file.includes('/logic/'))
				assert.doesNotMatch(source, /new (?:THREE\.)?(?:WebGPU|WebGL)Renderer/);
		});
	}
});
