import { expect, test } from 'bun:test';
import { relative, resolve } from 'node:path';
import { ESLint } from 'eslint';
import ts from 'typescript-eslint';
import { defineSettings, joinSettings } from '../src/config/setting';
import { duplicateConfigKeys, validateConfig } from './config/validate';
import { checkDomainFanout, readImportGraph } from './check-boundaries';

const root = resolve(import.meta.dir, '..');
const fixtures = resolve(import.meta.dir, 'fixtures/rules');
const eslint = new ESLint({
	cwd: root,
	// Fixture text has no TypeScript project. Architecture rules use its syntax and scopes.
	overrideConfig: [ts.configs.disableTypeChecked]
});

async function lintFixture(directory: string) {
	const results = [];
	for await (const file of new Bun.Glob('src/**/*.{ts,svelte}').scan(directory)) {
		const code = await Bun.file(resolve(directory, file)).text();
		// Map each fixture to its production path so the same flat config applies.
		results.push(...(await eslint.lintText(code, { filePath: file })));
	}
	return results.flatMap(({ messages }) =>
		messages.map(({ ruleId, message }) => `${ruleId}: ${message}`)
	);
}

const probes = [
	{
		fixture: '01-downward',
		graph: [
			'downward-only-core',
			'downward-only-core-test',
			'downward-only-domain',
			'downward-only-ui',
			'downward-only-world',
			'downward-only-scene'
		]
	},
	{ fixture: '02-cycles', graph: ['no-file-cycles', 'no-module-cycles'] },
	{
		fixture: '03-entry',
		graph: ['module-entry-only', 'module-entry-from-outside'],
		lint: [
			'no-restricted-syntax: Export each public name explicitly.',
			'no-restricted-syntax: Keep library files in a flat module directly under a layer.'
		]
	},
	{
		fixture: '04-headless',
		graph: ['headless-imports', 'three-only-in-scene'],
		lint: ['window', 'document', 'navigator', 'requestAnimationFrame'].map(
			(name) => `no-restricted-globals: Unexpected use of '${name}'`
		)
	},
	{ fixture: '05-domain-peers', fanout: 'domain-max-three:' },
	{
		fixture: '06-slots',
		lint: [
			...Array<string>(5).fill('no-restricted-syntax: Use a slot name in headless geometry.'),
			'architecture/no-restricted-constructor: Use a slot name in headless geometry.'
		]
	},
	{
		fixture: '07-styles',
		graph: ['app-css-only'],
		lint: [
			'no-restricted-syntax: Put styles in src/app.css.',
			'no-restricted-syntax: Use a class instead of a style attribute.',
			'no-restricted-syntax: Use a class instead of a style directive.'
		]
	},
	{
		fixture: '08-ui-kit',
		lint: [
			...Array<string>(4).fill('no-restricted-syntax: Use a control from src/lib/ui.'),
			...Array<string>(2).fill(
				'no-restricted-syntax: Import Bits UI and Lucide only in src/lib/ui.'
			)
		]
	},
	{ fixture: '09-routes', graph: ['routes-own-pages', 'three-only-in-scene'] },
	{
		fixture: '10-stage',
		lint: [
			...Array<string>(7).fill(
				'architecture/no-restricted-constructor: Create renderers and cameras in src/lib/scene/stage.'
			),
			...Array<string>(2).fill('no-restricted-syntax: Start frame loops in src/lib/scene/stage.')
		]
	},
	{
		fixture: '11-config',
		graph: ['config-owner-only-hydrology', 'config-data-only'],
		lint: Array<string>(9).fill(
			'config/no-tunable-number: Source numeric tunables from this module’s configuration slice.'
		)
	}
];

for (const { fixture, graph, lint, fanout } of probes) {
	test(
		fixture,
		async () => {
			const fail = resolve(fixtures, fixture, 'fail');
			const pass = resolve(fixtures, fixture, 'pass');

			if (graph || fanout) {
				const failGraph = readImportGraph(fail, ['src']);
				const passGraph = readImportGraph(pass, ['src']);
				if (fixture === '04-headless') {
					const blocked = failGraph.summary.violations.filter(
						({ rule, from }) =>
							rule.name === 'headless-imports' && from === 'src/lib/domain/shape/index.ts'
					);
					expect(blocked).toHaveLength(6);
				}
				const names = failGraph.summary.violations.map(({ rule }) => rule.name);
				expect([...new Set(names)].sort()).toEqual([...(graph ?? [])].sort());
				expect(passGraph.summary.violations).toEqual([]);

				if (fixture === '02-cycles') {
					const folderCycle = failGraph.summary.violations.find(
						({ rule, from }) => rule.name === 'no-module-cycles' && from === 'src/lib/domain/east'
					);
					expect(folderCycle).toBeDefined();
				}

				if (fanout) {
					const violations = checkDomainFanout(failGraph);
					expect(violations).toHaveLength(1);
					expect(violations[0]).toStartWith(fanout);
					expect(checkDomainFanout(passGraph)).toEqual([]);
				}
			}

			if (lint) {
				const messages = await lintFixture(fail);
				for (const expected of new Set(lint)) {
					expect(messages.filter((message) => message.startsWith(expected))).toHaveLength(
						lint.filter((entry) => entry === expected).length
					);
				}
				expect(await lintFixture(pass)).toEqual([]);
			}
		},
		15_000
	);
}

test('product lint ignores the fixture trees', async () => {
	const sample = resolve(fixtures, '06-slots/fail/src/lib/domain/shape/index.ts');
	expect(await eslint.isPathIgnored(relative(root, sample))).toBe(true);
});

test('settings metadata and ownership', () => {
	const good = defineSettings({
		setbackM: {
			value: [3, 5],
			unit: 'm',
			meaning: 'Distance behind the frontage',
			bounds: { exclusiveMin: 0 },
			principle: 'CITY-12'
		}
	});
	const principles = new Set(['CITY-12']);
	expect(validateConfig([{ path: 'city', entries: good }], principles)).toEqual([]);
	expect(() => joinSettings(good, good)).toThrow('Duplicate setting: setbackM');
	expect(
		duplicateConfigKeys('settings.ts', 'const values = { setbackM: {}, "setbackM": {} };')
	).toEqual(['settings.ts:1: duplicate key setbackM']);
	const bad = Object.freeze({
		setbackM: Object.freeze({ value: 3, meaning: 'Frontage offset', rationale: 'Calibration' }),
		riseM: Object.freeze({ value: Infinity, unit: 'm', meaning: '', principle: 'CITY-999' }),
		widthM: Object.freeze({
			value: 4,
			unit: 'm',
			meaning: 'Lane width',
			rationale: 'Calibration',
			bounds: Object.freeze({ exclusiveMin: 4 })
		})
	});
	expect(
		validateConfig(
			[
				{ path: 'city', entries: good },
				{ path: 'grid', entries: bad }
			],
			principles
		)
	).toEqual([
		'grid:setbackM: already owned by city',
		'grid:setbackM: requires a unit',
		'grid:riseM: requires a meaning',
		'grid:riseM: unknown principle',
		'grid:riseM: requires finite defaults',
		'grid:widthM: invalid bounds'
	]);
});
