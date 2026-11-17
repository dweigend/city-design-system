import { describe, expect, test } from 'bun:test';
import { resolveBaselineBase } from './baseline-base';
import { guardCruiseBaseline, guardEslintSuppressions, violationKey } from './baseline-guards';

const edge = (from: string, to: string, rule = 'data-no-logic') => ({
	from,
	to,
	rule: { name: rule }
});
const cycle = (...members: string[]) => ({
	from: members[0],
	to: members[1],
	rule: { name: 'no-cycles' },
	cycle: members.map((name) => ({ name }))
});

describe('guardCruiseBaseline', () => {
	test('passes an unchanged baseline that the tool still produces', () => {
		const entries = [edge('a', 'b'), cycle('x', 'y')];
		const result = guardCruiseBaseline({ base: entries, baseline: entries, produced: entries });
		expect(result).toEqual({ growth: [], stale: [] });
	});

	test('reports an entry the base ref does not have as growth', () => {
		const result = guardCruiseBaseline({
			base: [edge('a', 'b')],
			baseline: [edge('a', 'b'), edge('c', 'd')],
			produced: [edge('a', 'b'), edge('c', 'd')]
		});
		expect(result.growth).toEqual(['data-no-logic c -> d']);
		expect(result.stale).toEqual([]);
	});

	test('reports an entry the tool no longer produces as stale', () => {
		const result = guardCruiseBaseline({
			base: [edge('a', 'b')],
			baseline: [edge('a', 'b')],
			produced: []
		});
		expect(result.stale).toEqual(['data-no-logic a -> b']);
	});

	test('matches cycles by member set, like dependency-cruiser', () => {
		expect(violationKey(cycle('x', 'y'))).toBe(violationKey(cycle('y', 'x')));
		expect(violationKey(edge('a', 'b', 'r1'))).not.toBe(violationKey(edge('a', 'b', 'r2')));
	});
});

describe('guardEslintSuppressions', () => {
	const rule = '@typescript-eslint/no-non-null-assertion';
	const exists = () => true;

	test('passes equal and shrinking counts', () => {
		const base = { 'a.ts': { [rule]: { count: 3 } } };
		const current = { 'a.ts': { [rule]: { count: 2 } } };
		expect(guardEslintSuppressions({ base, current, fileExists: exists })).toEqual({
			growth: [],
			stale: []
		});
	});

	test('reports a higher count and a new file or rule as growth', () => {
		const base = { 'a.ts': { [rule]: { count: 1 } } };
		const current = {
			'a.ts': { [rule]: { count: 2 }, complexity: { count: 1 } },
			'b.ts': { [rule]: { count: 1 } }
		};
		const { growth } = guardEslintSuppressions({ base, current, fileExists: exists });
		expect(growth).toEqual([
			`a.ts ${rule}: 1 -> 2`,
			'a.ts complexity: 0 -> 1',
			`b.ts ${rule}: 0 -> 1`
		]);
	});

	test('reports entries for missing files as stale', () => {
		const current = { 'gone.ts': { [rule]: { count: 1 } } };
		const { stale } = guardEslintSuppressions({ base: current, current, fileExists: () => false });
		expect(stale).toEqual(['gone.ts: file does not exist']);
	});
});

describe('resolveBaselineBase', () => {
	test('requires BASELINE_BASE in CI', () => {
		expect(() => resolveBaselineBase({ CI: 'true' })).toThrow('BASELINE_BASE must be set');
	});

	test('resolves an explicit ref to a commit SHA', () => {
		expect(resolveBaselineBase({ BASELINE_BASE: 'HEAD' })).toMatch(/^[0-9a-f]{40}$/);
	});

	test('rejects a ref git cannot resolve', () => {
		expect(() => resolveBaselineBase({ BASELINE_BASE: 'no-such-ref-xyz' })).toThrow(
			'cannot resolve'
		);
	});
});
