import { expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { buildModuleCatalogue } from './module-catalogue';
import { readModuleCatalogue } from './read-module-catalogue';

test('discovers public names, aliases, the fixed caller, config ownership and known citations', () => {
	const [row] = buildModuleCatalogue(
		{
			'src/lib/core/marker/index.ts': [
				'/** Module: Places a survey marker. */',
				"export { Survey as Marker, type Point } from './marker';",
				'export interface Label { name: string }',
				'export const roles = [], names = [];',
				'export function create(): void;',
				'export function create() {}'
			].join('\n'),
			'src/lib/core/marker/marker.ts':
				"import { defaults } from '../../../config/survey'; // LIB-2, LIB-999",
			'src/lib/core/marker/example.ts':
				"import { create } from './index'; export const example = () => create();",
			'src/config/survey/index.ts': '// GRID-1',
			'src/lib/core/marker/contract.test.ts': '// LIB-7'
		},
		new Set(['LIB-2', 'LIB-7', 'GRID-1'])
	);
	expect(row).toEqual({
		module: 'core/marker',
		purpose: 'Places a survey marker.',
		exports: ['Marker', 'Point', 'Label', 'roles', 'names', 'create'],
		example: 'src/lib/core/marker/example.ts',
		exampleCall: 'example',
		exampleDemo: null,
		config: ['survey'],
		principles: ['GRID-1', 'LIB-2'],
		errors: []
	});
});

test('reports missing purpose, missing example and example without a caller', () => {
	const rows = buildModuleCatalogue(
		{
			'src/lib/core/marker/index.ts': 'export const marker = 1;',
			'src/lib/core/unusable/index.ts': '/** Module: Marks a site. */',
			'src/lib/core/unusable/example.ts': 'export const marker = 1;',
			'src/lib/core/helpers.ts': 'export const helper = 1;'
		},
		new Set()
	);
	expect(rows.map(({ errors }) => errors)).toEqual([
		['Missing module purpose in index.ts', 'Missing example.ts'],
		['Missing example caller']
	]);
});

test('rejects whitespace purposes and examples whose result bypasses their public entry', () => {
	const entry = 'src/lib/core/marker/index.ts';
	const example = 'src/lib/core/marker/example.ts';
	const sources = { [entry]: '/** Module:    */\nexport function create() { return 1; }' };
	for (const body of [
		'export const example = () => 1;',
		"import { create } from './index'; export function example() { create(); return 1; }",
		"import { create } from './private'; export const example = () => create();"
	]) {
		const [row] = buildModuleCatalogue({ ...sources, [example]: body }, new Set());
		expect(row.errors).toEqual(['Missing module purpose in index.ts', 'Missing example caller']);
	}
	const [row] = buildModuleCatalogue(
		{
			...sources,
			[example]:
				"import { create as build } from './index'; export function example() { const output = build(); return { output }; }"
		},
		new Set()
	);
	expect(row.exampleCall).toBe('example');
});

test('reads the UI example exemption from the architecture standard', () => {
	const entries = {
		'src/lib/ui/button/index.ts': '/** Module: Runs an action. */',
		'src/lib/scene/stage-view/index.ts': '/** Module: Hosts a stage. */'
	};
	const rule =
		'Modules under `src/lib/ui` are presentational and are demonstrated on the `/interface` page instead of carrying `contract.test.ts` and `example.ts`.';
	const rows = buildModuleCatalogue(
		{ ...entries, 'docs/standards/ARCHITECTURE.md': rule },
		new Set()
	);
	expect(rows.map(({ errors, exampleDemo }) => [errors, exampleDemo])).toEqual([
		[['Missing example.ts'], null],
		[[], '/interface']
	]);
	expect(buildModuleCatalogue(entries, new Set())[1].errors).toEqual(['Missing example.ts']);
});

const rows = await readModuleCatalogue();
test('discovers the real registry and stage modules', () => {
	expect(rows.map(({ module }) => module)).toContain('world/asset-registry');
	expect(rows.map(({ module }) => module)).toContain('scene/stage');
	expect(rows.filter(({ errors }) => errors.length)).toEqual([]);
});
for (const { module, example, exampleCall } of rows) {
	if (!example || !exampleCall) continue;
	test(`module example: ${module}`, async () => {
		const imported = (await import(resolve(import.meta.dir, '..', example))) as Record<
			string,
			unknown
		>;
		const run = imported[exampleCall];
		if (typeof run !== 'function') throw new TypeError(`Expected callable export ${exampleCall}`);
		expect(await run()).toBeDefined();
	}, 30_000);
}
