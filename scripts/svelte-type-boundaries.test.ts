import { afterEach, describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import cases from './fixtures/svelte-type-boundaries/cases.json';
import { checkTypeEdges, createTypeResolver, typeSpecifiers } from './svelte-type-boundaries';
import {
	cleanupFixtures,
	config,
	fixture,
	repo,
	runtimeGate
} from './svelte-type-boundaries.fixture';

afterEach(cleanupFixtures);

describe('Svelte type boundary supplement', () => {
	test('valid type import is allowed', () => {
		const result = fixture(cases.valid);
		expect(result.edges).toHaveLength(1);
		expect(result.findings).toEqual([]);
	});
	test('only the erased Svelte edge closes a cycle through two TS modules', () => {
		const { graph, edges, findings } = fixture(cases.cycle);
		expect(
			graph.modules
				.find((m) => m.source.endsWith('View.svelte'))
				?.dependencies.some((d) => d.resolved.endsWith('scene/model.ts'))
		).toBe(false);
		expect(edges).toHaveLength(1);
		expect(findings.some((f) => f.startsWith('no-cycles:') && f.includes('scene/link.ts'))).toBe(
			true
		);
	});
	test.each([
		['valid', 0],
		['cycle', 1]
	] as const)('CLI gate exits correctly for %s', (name, exitCode) => {
		const { root } = fixture(cases[name]);
		const run = Bun.spawnSync(
			[process.execPath, resolve(repo, 'scripts/check-svelte-type-boundaries.ts')],
			{ cwd: root }
		);
		expect(run.exitCode).toBe(exitCode);
		expect(run.stdout.toString()).toContain('Svelte type boundaries:');
		if (exitCode === 1) expect(run.stderr.toString()).toContain('no-cycles:');
	});
	test.each([
		['', 'import { type Model } from "../scene/model";'],
		['module', 'import { type Model } from "../scene/model";'],
		['module', 'export type { Model } from "../scene/model";'],
		['module', 'export { type Model } from "../scene/model";']
	])('cycle remains visible for %s script: %s', (context, statement) => {
		const result = fixture({
			...cases.cycle,
			'src/lib/catalog/ui/View.svelte': `<script ${context} lang="ts">${statement}</script>`
		});
		expect(result.findings.some((f) => f.startsWith('no-cycles:'))).toBe(true);
	});
	test('two erased edges participate in the same graph', () => {
		const result = fixture(cases.twoTypeEdges);
		expect(result.edges).toHaveLength(2);
		expect(result.findings.filter((f) => f.startsWith('no-cycles:'))).toHaveLength(2);
	});
	test('Svelte wildcard declarations cannot hide a local type cycle or missing file', () => {
		const { root, edges, findings } = fixture({
			...cases.twoTypeEdges,
			'src/ambient.d.ts':
				'declare module "*.svelte" { const component: unknown; export default component; }'
		});
		expect(edges.map((edge) => edge.to).sort()).toEqual(
			['src/lib/catalog/ui/View.svelte', 'src/lib/catalog/ui/Other.svelte'].sort()
		);
		expect(findings.filter((finding) => finding.startsWith('no-cycles:'))).toHaveLength(2);
		const resolveType = createTypeResolver(root, config.options.enhancedResolveOptions.extensions);
		expect(() => resolveType('src/lib/catalog/ui/View.svelte', './Missing.svelte')).toThrow();
		expect(() =>
			resolveType('src/lib/catalog/ui/View.svelte', '$lib/catalog/ui/Missing.svelte')
		).toThrow();
		const run = Bun.spawnSync(
			[process.execPath, resolve(repo, 'scripts/check-svelte-type-boundaries.ts')],
			{ cwd: root }
		);
		expect(run.exitCode).toBe(1);
		expect(run.stderr.toString()).toContain('no-cycles:');
	});
	test('real project Svelte declarations preserve physical graph identities', () => {
		const resolveType = createTypeResolver(repo, config.options.enhancedResolveOptions.extensions);
		const from = 'src/lib/catalog/bibel/PrincipleList.svelte';
		expect(resolveType(from, './PrincipleList.svelte')).toBe(from);
		expect(() => resolveType(from, './MissingTask05Component.svelte')).toThrow();
	});
	test('existing headless rule applies to an erased edge without a new exception', () => {
		expect(fixture(cases.boundary).findings).toEqual([
			'headless-core: src/lib/catalog/logic/View.svelte -> src/lib/catalog/scene/model.ts'
		]);
	});
	test('unresolved type dependency fails instead of disappearing', () => {
		expect(() => fixture(cases.unresolved)).toThrow("Can't resolve './missing'");
	});
	test.each(['node:fs', 'node:buffer', 'buffer'])(
		'valid builtin type import %s is allowed by the CLI',
		(specifier) => {
			const { root } = fixture({
				'src/lib/catalog/ui/View.svelte': `<script lang="ts">import type * as T from '${specifier}';</script>`
			});
			const run = Bun.spawnSync(
				[process.execPath, resolve(repo, 'scripts/check-svelte-type-boundaries.ts')],
				{ cwd: root }
			);
			expect(run.exitCode).toBe(0);
		}
	);
	test('declared ambient mixed import is allowed, but a misspelled module fails', () => {
		const { root, edges } = fixture({
			'src/ambient.d.ts':
				'declare module "$app/navigation" { export interface GotoOptions {} export function goto(): void; }',
			'src/lib/catalog/ui/View.svelte':
				'<script lang="ts">import { goto, type GotoOptions } from "$app/navigation";</script>'
		});
		expect(edges[0]?.to).toBe('$app/navigation');
		const resolveType = createTypeResolver(root, config.options.enhancedResolveOptions.extensions);
		expect(() => resolveType('src/lib/catalog/ui/View.svelte', '$app/navigatoin')).toThrow();
		expect(() => resolveType('src/lib/catalog/ui/View.svelte', 'node:not-a-builtin')).toThrow();
		const run = Bun.spawnSync(
			[process.execPath, resolve(repo, 'scripts/check-svelte-type-boundaries.ts')],
			{ cwd: root }
		);
		expect(run.exitCode).toBe(0);
	});
	test('installed three declarations retain the forbidden package identity', () => {
		const resolveType = createTypeResolver(repo, config.options.enhancedResolveOptions.extensions);
		const from = 'src/lib/catalog/logic/View.svelte';
		const to = resolveType(from, 'three');
		expect(to).toBe('three');
		// A Svelte file in a headless folder answers to both its folder and its component layer.
		expect(checkTypeEdges([], [{ from, to, specifier: 'three' }], config.forbidden)).toEqual([
			`headless-core: ${from} -> three`,
			`component-no-three: ${from} -> three`
		]);
		expect(resolveType('src/lib/catalog/ui/View.svelte', '$app/navigation')).toBe(
			'$app/navigation'
		);
	});
	test('CLI rejects an erased three import resolved through @types', () => {
		const { root } = fixture({
			'node_modules/@types/three/index.d.ts': 'export interface Vector3 { x: number }',
			'src/lib/catalog/logic/View.svelte':
				'<script lang="ts">import type { Vector3 } from "three";</script>'
		});
		const run = Bun.spawnSync(
			[process.execPath, resolve(repo, 'scripts/check-svelte-type-boundaries.ts')],
			{ cwd: root }
		);
		expect(run.exitCode).toBe(1);
		expect(run.stderr.toString()).toContain(
			'headless-core: src/lib/catalog/logic/View.svelte -> three'
		);
	});
	test.each([
		'import type Model from "./model";',
		'import type * as Model from "./model";',
		'import { type Model } from "./model";',
		'import { value, type Model } from "./model";',
		'export type { Model } from "./model";',
		'export { type Model } from "./model";',
		'export type * from "./model";'
	])('AST captures %s in instance and module scripts', (statement) => {
		for (const context of ['', 'module', 'context="module"']) {
			expect(typeSpecifiers(`<script ${context} lang="ts">${statement}</script>`)).toEqual([
				'./model'
			]);
		}
	});
	test('comments, strings, markup and value-only imports are not type edges', () => {
		expect(
			typeSpecifiers(`<script lang="ts">// import type X from 'fake';
		const text = "import type X from 'fake'"; import X from './value';</script>
		<p>import type X from 'fake'</p>`)
		).toEqual([]);
	});
	test.each(['../data/model.js', '$lib/catalog/data/model', '#lib/catalog/data/model'])(
		'resolves %s to the actual TS node',
		(specifier) => {
			const files = {
				...cases.valid,
				'src/lib/catalog/ui/View.svelte': `<script lang="ts">import type { Model } from '${specifier}';</script>`
			};
			expect(fixture(files).edges[0]?.to).toBe('src/lib/catalog/data/model.ts');
		}
	);
	test('adding an acyclic edge does not re-report an old unrelated cycle', () => {
		const modules = [
			{ source: 'a.ts', dependencies: [{ resolved: 'b.ts' }] },
			{ source: 'b.ts', dependencies: [{ resolved: 'a.ts' }] }
		];
		expect(
			checkTypeEdges(
				modules,
				[{ from: 'View.svelte', to: 'a.ts', specifier: './a' }],
				config.forbidden
			)
		).toEqual([]);
	});
});

describe('Test layer precedence', () => {
	test.each([
		'src/lib/catalog/data/model.ts',
		'src/lib/catalog/logic/model.ts',
		'src/lib/catalog/scene/model.ts',
		'src/routes/model.ts'
	])('non-dev file %s cannot import a test, including types', (from) => {
		// The test sits outside every runtime layer, so only the dev rule can fire.
		const to = 'src/lib/catalog/ui/model.test.ts';
		for (const statement of [
			`import '$lib/catalog/ui/model.test';`,
			`import type { Model } from '$lib/catalog/ui/model.test'; export type Value = Model;`
		]) {
			const result = fixture({ [from]: statement, [to]: 'export interface Model {}' });
			const run = runtimeGate(result.root);
			expect(run.exitCode).toBe(1);
			expect(run.stdout.toString()).toContain('no-runtime-to-dev');
			expect(checkTypeEdges([], [{ from, to, specifier: to }], config.forbidden)).toEqual([
				`no-runtime-to-dev: ${from} -> ${to}`
			]);
		}
	});

	test('Svelte type import of a test fails the supplemental CLI gate', () => {
		const from = 'src/lib/catalog/ui/View.svelte';
		const to = 'src/lib/catalog/data/model.test.ts';
		const result = fixture({
			[from]: '<script lang="ts">import type { Model } from "../data/model.test";</script>',
			[to]: 'export interface Model {}'
		});
		expect(result.findings).toEqual([`no-runtime-to-dev: ${from} -> ${to}`]);
		const run = Bun.spawnSync(
			[process.execPath, resolve(repo, 'scripts/check-svelte-type-boundaries.ts')],
			{ cwd: result.root }
		);
		expect(run.exitCode).toBe(1);
		expect(run.stderr.toString()).toContain('no-runtime-to-dev');
	});

	test.each(['model.test.ts', 'benchmark.ts'])(
		'dev file %s may import a test or benchmark',
		(name) => {
			const result = fixture({
				[`src/lib/catalog/scene/${name}`]:
					"import '../logic/other.test'; import '../logic/benchmark';",
				'src/lib/catalog/logic/other.test.ts': 'export {};',
				'src/lib/catalog/logic/benchmark.ts': 'export {};'
			});
			expect(runtimeGate(result.root).exitCode).toBe(0);
		}
	);

	test('non-dev file cannot import a benchmark', () => {
		const result = fixture({
			'src/lib/catalog/logic/model.ts': "import './benchmark';",
			'src/lib/catalog/logic/benchmark.ts': 'export {};'
		});
		const run = runtimeGate(result.root);
		expect(run.exitCode).toBe(1);
		expect(run.stdout.toString()).toContain('no-runtime-to-dev');
	});

	test.each(['data', 'logic'])('tests under %s may import logic and scene', (layer) => {
		const from = `src/lib/catalog/${layer}/nested/model.test.ts`;
		const targets = ['logic/model.ts', 'scene/model.ts'];
		const result = fixture({
			[from]: targets.map((target) => `import '../../${target}';`).join('\n'),
			'src/lib/catalog/logic/model.ts': 'export const value = 1;',
			'src/lib/catalog/scene/model.ts': 'export const value = 2;'
		});
		expect(runtimeGate(result.root).exitCode).toBe(0);
		expect(result.graph.modules.find((m) => m.source === from)?.dependencies).toHaveLength(2);
		expect(
			checkTypeEdges(
				[],
				targets.map((target) => ({
					from,
					to: `src/lib/catalog/${target}`,
					specifier: target
				})),
				config.forbidden
			)
		).toEqual([]);
	});

	test.each([
		['logic', 'data-no-logic'],
		['scene', 'headless-core']
	])('production data still rejects %s imports', (layer, rule) => {
		const from = 'src/lib/catalog/data/nested/model.ts';
		const to = `src/lib/catalog/${layer}/model.ts`;
		const result = fixture({
			[from]: `import '../../${layer}/model';`,
			[to]: 'export const value = 1;'
		});
		const run = runtimeGate(result.root);
		expect(run.exitCode).toBe(1);
		expect(run.stdout.toString()).toContain(rule);
		expect(checkTypeEdges([], [{ from, to, specifier: to }], config.forbidden)).toEqual([
			`${rule}: ${from} -> ${to}`
		]);
	});
});

describe('Core layer boundary', () => {
	test.each([
		"import '../../logic/legacy';",
		"export type { Model } from '$lib/catalog/logic/legacy';"
	])('rejects dependencies on legacy logic through %s', (statement) => {
		const { root } = fixture({
			'src/lib/catalog/core/params/index.ts': statement,
			'src/lib/catalog/logic/legacy.ts': 'export type Model = number;'
		});
		const run = runtimeGate(root);
		expect(run.exitCode).toBe(1);
		expect(run.stdout.toString()).toContain('core-no-higher-layers');
	});

	test.each(['scripts', 'docs'])('rejects a scene re-export through %s', (directory) => {
		const core = 'src/lib/catalog/core/random/index.ts';
		const adapter = `${directory}/adapter.ts`;
		const { graph } = fixture({
			[core]: `export { value } from '../../../../../${directory}/adapter';`,
			[adapter]: "export { value } from '../src/lib/catalog/scene/higher';",
			'src/lib/catalog/scene/higher.ts': 'export const value = 1;'
		});
		expect(graph.summary.violations).toMatchObject([
			{ from: core, to: adapter, rule: { name: 'core-no-higher-layers' } }
		]);
	});

	test('rejects cross-module, external private and contract-test private imports', () => {
		const params = 'src/lib/catalog/core/params/index.ts';
		const random = 'src/lib/catalog/core/random/index.ts';
		const privateFile = 'src/lib/catalog/core/random/private.ts';
		const contract = 'src/lib/catalog/core/random/contract.test.ts';
		const consumer = 'src/lib/catalog/logic/consumer.ts';
		const { graph } = fixture({
			[params]: "import '../random';",
			[random]: "export { value } from './private';",
			[privateFile]: 'export const value = 1;',
			[contract]: "import './private';",
			[consumer]: "import '$lib/catalog/core/random/private';"
		});
		expect(
			graph.summary.violations.map(({ from, to, rule }) => [from, to, rule.name]).sort()
		).toEqual([
			[params, random, 'core-params-independent'],
			[contract, privateFile, 'core-random-public-entry'],
			[consumer, privateFile, 'core-random-public-entry']
		]);
	});

	test('allows private code within a module and public imports from consumers and contracts', () => {
		const { root } = fixture({
			'src/lib/catalog/core/params/index.ts': "export { value } from './value';",
			'src/lib/catalog/core/params/value.ts': 'export const value = 1;',
			'src/lib/catalog/core/params/value.unit.test.ts': "import './value';",
			'src/lib/catalog/core/params/contract.test.ts': "import './index';",
			'src/lib/catalog/logic/legacy.ts': "export { value } from '../core/params';"
		});
		expect(runtimeGate(root).exitCode).toBe(0);
	});
});
