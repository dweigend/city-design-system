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
			'src/lib/core/marker/example.ts': 'export const example = () => create();',
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

const rows = await readModuleCatalogue();
test('discovers the real registry and stage modules', () => {
	expect(rows.map(({ module }) => module)).toContain('world/asset-registry');
	expect(rows.map(({ module }) => module)).toContain('scene/stage');
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
