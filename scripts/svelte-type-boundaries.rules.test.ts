import { afterEach, describe, expect, test } from 'bun:test';
import cases from './fixtures/boundary-rules/cases.json';
import { assertSupportedRules } from './svelte-type-boundaries';
import { cleanupFixtures, config, fixture, typeGate } from './svelte-type-boundaries.fixture';

afterEach(cleanupFixtures);

const rule = (name: string) => config.forbidden.find((r: { name: string }) => r.name === name);

describe('Import matrix rules (A-20 to A-28)', () => {
	test.each(Object.entries(cases.negative))('negative fixture %s fires its rule', (_, c) => {
		const { violations } = fixture(c.files);
		expect(violations.length).toBeGreaterThan(0);
		expect(violations.every((v) => v.startsWith(`${c.rule}: `))).toBe(true);
	});

	test('allowed edges of every layer pass all rules', () => {
		const { violations, findings } = fixture(cases.allowed);
		expect(violations).toEqual([]);
		expect(findings).toEqual([]);
	});

	test('transitive data rule sees the chain through a file outside every layer', () => {
		const { violations } = fixture(cases.negative['data-transitive'].files);
		expect(violations).toEqual([
			'data-no-logic: src/lib/catalog/data/model.ts -> src/lib/catalog/logic/rule.ts'
		]);
	});

	test('a Svelte type edge that opens a new reachable path fails the supplement', () => {
		const { violations, findings, root } = fixture(cases.reachableTypeEdge);
		// The runtime graph sees only data -> component (and its compiled svelte imports).
		expect(violations).toContain(
			'headless-core: src/lib/catalog/data/model.ts -> src/lib/catalog/ui/View.svelte'
		);
		expect(violations.every((v) => v.startsWith('headless-core: '))).toBe(true);
		expect(findings).toEqual([
			'data-no-logic: src/lib/catalog/data/model.ts -> src/lib/catalog/ui/View.svelte -> src/lib/catalog/logic/rule.ts'
		]);
		const run = typeGate(root);
		expect(run.exitCode).toBe(1);
		expect(run.stderr.toString()).toContain('data-no-logic:');
	});

	test('an erased Svelte type import of three fails component-no-three', () => {
		const { findings } = fixture({
			'node_modules/@types/three/index.d.ts': 'export interface Vector3 { x: number }',
			'src/lib/catalog/ui/View.svelte':
				'<script lang="ts">import type { Vector3 } from "three"; let v: Vector3;</script>'
		});
		expect(findings).toEqual(['component-no-three: src/lib/catalog/ui/View.svelte -> three']);
	});
});

describe('Supplement rule shapes', () => {
	test('the project configuration is fully supported', () => {
		expect(() => assertSupportedRules(config.forbidden)).not.toThrow();
	});

	test.each([
		['unknown rule key', { ...rule('route-thin'), scope: 'folder' }],
		['unknown from key', { ...rule('route-thin'), from: { orphan: true } }],
		['unknown to key', { ...rule('route-thin'), to: { path: 'x', dependencyTypes: ['npm'] } }],
		['reachable false', { ...rule('headless-core'), to: { path: 'x', reachable: false } }],
		['circular false', { ...rule('no-cycles'), to: { circular: false } }],
		['two graph modes', { ...rule('no-cycles'), to: { circular: true, reachable: true } }]
	])('rejects %s', (_, shape) => {
		expect(() => assertSupportedRules([shape])).toThrow('Unsupported boundary rule shape');
	});
});
