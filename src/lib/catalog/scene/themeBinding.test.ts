import { describe, it as test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const drawingRendererFile = join('src', 'lib', 'catalog', 'scene', 'drawing-renderer.ts');

function files(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
		e.isDirectory()
			? files(join(dir, e.name))
			: /\.(ts|svelte)$/.test(e.name) && !e.name.endsWith('.test.ts')
				? [join(dir, e.name)]
				: []
	);
}
// The shared drawing setup in 25b02fae returns its renderer to the scene that owns the binding.
function forwardsDrawingRenderer(node: ts.NewExpression, owner: ts.Node | undefined, file: string) {
	const declaration = node.parent;
	if (
		file !== drawingRendererFile ||
		!owner ||
		!ts.isFunctionDeclaration(owner) ||
		owner.name?.text !== 'createDrawingRenderer' ||
		!ts.isVariableDeclaration(declaration) ||
		!ts.isIdentifier(declaration.name)
	)
		return false;

	const renderer = declaration.name.text;
	return owner.body?.statements.some(
		(statement) =>
			ts.isReturnStatement(statement) &&
			statement.expression &&
			ts.isIdentifier(statement.expression) &&
			statement.expression.text === renderer
	);
}

function createsRenderer(node: ts.Node, tree: ts.SourceFile) {
	if (ts.isNewExpression(node))
		return /(?:^|\.)(?:WebGPU|WebGL)Renderer$/.test(node.expression.getText(tree));
	return (
		ts.isCallExpression(node) &&
		ts.isIdentifier(node.expression) &&
		node.expression.text === 'createDrawingRenderer'
	);
}

function ownsThemeBinding(owner: ts.Node | undefined, tree: ts.SourceFile) {
	const body = owner?.getText(tree) ?? '';
	return (
		/const\s+stopTheme\s*=\s*bindSceneTheme\(canvas,\s*scene,\s*renderer,/.test(body) &&
		/stopTheme\(\)/.test(body)
	);
}

function unbound(source: string, file = ''): number {
	const scripts = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
	const code = scripts.length ? scripts.map((match) => match[1]).join('\n') : source;
	const tree = ts.createSourceFile('scene.ts', code, ts.ScriptTarget.Latest, true);
	let missing = 0;
	function visit(node: ts.Node) {
		if (createsRenderer(node, tree)) {
			let owner: ts.Node | undefined = node.parent;
			while (owner && !ts.isFunctionLike(owner)) owner = owner.parent;
			const forwards = ts.isNewExpression(node) && forwardsDrawingRenderer(node, owner, file);
			if (!forwards && !ownsThemeBinding(owner, tree)) missing++;
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
	test('a caller of the shared renderer must register and stop its binding', () => {
		const scene = 'function mount() { const renderer = createDrawingRenderer(canvas);';
		const bind = 'const stopTheme = bindSceneTheme(canvas, scene, renderer, redraw);';
		assert.equal(unbound(scene + '}'), 1);
		assert.equal(unbound(scene + bind + '}'), 1);
		assert.equal(unbound(scene + bind + 'return { dispose() { stopTheme(); } }; }'), 0);
	});
	test('the shared setup can only forward the renderer it returns', () => {
		const setup =
			'function createDrawingRenderer() { const renderer = new WebGPURenderer(); return renderer; }';
		assert.equal(unbound(setup, drawingRendererFile), 0);
		assert.equal(unbound(setup, 'some-other-file.ts'), 1);
		assert.equal(
			unbound(
				setup.replace('return renderer;', 'new WebGLRenderer(); return renderer;'),
				drawingRendererFile
			),
			1
		);
	});
	for (const file of files('src')) {
		test(file, () => {
			const source = readFileSync(file, 'utf8');
			assert.equal(unbound(source, file), 0);
			if (!file.includes('/theme/'))
				assert.doesNotMatch(source, /matchMedia\(['"]\(prefers-color-scheme/);
			if (file.includes('/data/') || file.includes('/logic/'))
				assert.doesNotMatch(source, /new (?:THREE\.)?(?:WebGPU|WebGL)Renderer/);
		});
	}
});
