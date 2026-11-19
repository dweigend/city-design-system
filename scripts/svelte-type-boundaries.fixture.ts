import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import {
	checkTypeEdges,
	collectTypeEdges,
	createTypeResolver,
	type GraphModule
} from './svelte-type-boundaries';

/** Shared fixture harness for the boundary gate tests: temporary repos with the real config. */
export const repo = resolve(import.meta.dir, '..');
export const config = createRequire(import.meta.url)('../.dependency-cruiser.cjs');
const depcruise = resolve(repo, 'node_modules/dependency-cruiser/bin/dependency-cruiser.mjs');

const fixtureRoots: string[] = [];

/** Removes every fixture repo created since the last call; register it with `afterEach`. */
export function cleanupFixtures() {
	for (const root of fixtureRoots.splice(0)) rmSync(root, { recursive: true, force: true });
}

/** Writes `files` into a temporary repo, cruises it and runs the type supplement. */
export function fixture(files: Record<string, string>) {
	const root = mkdtempSync(resolve(tmpdir(), 'city-type-boundaries-'));
	fixtureRoots.push(root);
	for (const [name, source] of Object.entries({
		'src/fixture.ts': 'export {};',
		'package.json': JSON.stringify({ type: 'module', imports: { '#lib/*': './src/lib/*' } }),
		'tsconfig.json': JSON.stringify({
			compilerOptions: {
				module: 'esnext',
				moduleResolution: 'bundler',
				paths: { '$lib/*': ['./src/lib/*'] }
			}
		}),
		'.dependency-cruiser.cjs': `module.exports = ${JSON.stringify(config)}`,
		...files
	})) {
		mkdirSync(dirname(resolve(root, name)), { recursive: true });
		writeFileSync(resolve(root, name), source);
	}
	const run = Bun.spawnSync(
		[
			process.execPath,
			depcruise,
			'src',
			'--config',
			'.dependency-cruiser.cjs',
			'--output-type',
			'json'
		],
		{ cwd: root }
	);
	if (![0, 1].includes(run.exitCode) || !run.stdout.length) throw new Error(run.stderr.toString());
	const graph: {
		modules: GraphModule[];
		summary: { violations: { rule: { name: string }; from: string; to: string }[] };
	} = JSON.parse(run.stdout.toString());
	const edges = collectTypeEdges(
		graph.modules,
		root,
		createTypeResolver(root, config.options.enhancedResolveOptions.extensions)
	);
	return {
		graph,
		edges,
		findings: checkTypeEdges(graph.modules, edges, config.forbidden),
		/** Runtime-gate findings as `rule: from -> to`, without any baseline. */
		violations: graph.summary.violations.map((v) => `${v.rule.name}: ${v.from} -> ${v.to}`),
		root
	};
}

/** Runs the plain dependency-cruiser gate (no baseline) inside a fixture repo. */
export function runtimeGate(root: string) {
	return Bun.spawnSync(
		[process.execPath, depcruise, 'src', '--config', '.dependency-cruiser.cjs'],
		{ cwd: root }
	);
}

/** Runs the Svelte type supplement CLI inside a fixture repo. */
export function typeGate(root: string) {
	return Bun.spawnSync(
		[process.execPath, resolve(repo, 'scripts/check-svelte-type-boundaries.ts')],
		{
			cwd: root
		}
	);
}
