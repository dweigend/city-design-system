import { describe, expect, test } from 'bun:test';
import { resolveBaselineBase } from './baseline-base';
import { readFileSync } from 'node:fs';
import {
	findingText,
	guardCruiseBaseline,
	guardEslintSuppressions,
	violationKey
} from './baseline-guards';
import { lintFindings, suppressionLinter } from './check-baselines';

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

const rule = '@typescript-eslint/no-non-null-assertion';

describe('findingText', () => {
	test('cuts the reported range and drops whitespace', () => {
		const source = 'const a = 1;\nconst b = list.find(\n\t(x) => x > a\n)!.name;\n';
		const range = { line: 2, column: 11, endLine: 4, endColumn: 3 };
		expect(findingText(source, range)).toBe('list.find((x)=>x>a)!');
	});

	test('takes the rest of the line when the message has no end', () => {
		expect(findingText('a;\n  b!.c;\nd;\n', { line: 2, column: 3 })).toBe('b!.c;');
	});
});

describe('guardEslintSuppressions', () => {
	/** Guards one file whose suppression count always equals its findings. */
	const guard = (base: string[], current: string[]) =>
		guardEslintSuppressions({
			base: { 'a.ts': { [rule]: { count: base.length } } },
			current: { 'a.ts': { [rule]: { count: current.length } } },
			baseFindings: { 'a.ts': { [rule]: base } },
			currentFindings: { 'a.ts': { [rule]: current } },
			fileExists: () => true
		});

	test('passes unchanged, reordered and removed findings', () => {
		expect(guard(['x!', 'y!', 'y!'], ['x!', 'y!', 'y!'])).toEqual({ growth: [], stale: [] });
		expect(guard(['x!', 'y!', 'y!'], ['y!', 'x!', 'y!'])).toEqual({ growth: [], stale: [] });
		expect(guard(['x!', 'y!', 'y!'], ['y!'])).toEqual({ growth: [], stale: [] });
	});

	test('reports a new finding that replaces a removed one at the same count', () => {
		expect(guard(['x!', 'y!'], ['x!', 'z!'])).toEqual({
			growth: [`a.ts ${rule}: new finding \`z!\` (0 -> 1)`],
			stale: []
		});
	});

	test('counts identical findings, so a duplicate cannot replace another finding', () => {
		expect(guard(['x!', 'y!'], ['x!', 'x!']).growth).toEqual([
			`a.ts ${rule}: new finding \`x!\` (1 -> 2)`
		]);
	});

	test('reports a higher count and a new file or rule as growth', () => {
		const { growth } = guardEslintSuppressions({
			base: { 'a.ts': { [rule]: { count: 1 } } },
			current: {
				'a.ts': { [rule]: { count: 2 }, complexity: { count: 1 } },
				'b.ts': { [rule]: { count: 1 } }
			},
			baseFindings: { 'a.ts': { [rule]: ['x!'] } },
			currentFindings: {
				'a.ts': { [rule]: ['x!', 'y!'], complexity: ['f(){}'] },
				'b.ts': { [rule]: ['z!'] }
			},
			fileExists: () => true
		});
		expect(growth).toEqual([
			`a.ts ${rule}: 1 -> 2`,
			`a.ts ${rule}: new finding \`y!\` (0 -> 1)`,
			'a.ts complexity: 0 -> 1',
			'a.ts complexity: new finding `f(){}` (0 -> 1)',
			`b.ts ${rule}: 0 -> 1`,
			`b.ts ${rule}: new finding \`z!\` (0 -> 1)`
		]);
	});

	test('reports a count above the reported findings as stale', () => {
		const suppressions = { 'a.ts': { [rule]: { count: 2 } } };
		const findings = { 'a.ts': { [rule]: ['x!'] } };
		const result = guardEslintSuppressions({
			base: suppressions,
			current: suppressions,
			baseFindings: { 'a.ts': { [rule]: ['x!', 'y!'] } },
			currentFindings: findings,
			fileExists: () => true
		});
		expect(result).toEqual({ growth: [], stale: [`a.ts ${rule}: count 2, eslint reports 1`] });
	});

	test('reports entries for missing files as stale', () => {
		const current = { 'gone.ts': { [rule]: { count: 1 } } };
		const { stale } = guardEslintSuppressions({
			base: current,
			current,
			baseFindings: {},
			currentFindings: {},
			fileExists: () => false
		});
		expect(stale).toEqual(['gone.ts: file does not exist']);
	});
});

// End to end with the real ESLint config: one accepted assertion in a real,
// typed catalog file, edited in memory. The file on disk is never changed.
describe('suppressed findings in a linted file', () => {
	const file = 'src/lib/catalog/logic/ansicht/werkbank.ts';
	const accepted = 'flows.find((f) => f.id === strom)!.name';
	const source = readFileSync(file, 'utf8');
	const eslint = suppressionLinter({ [file]: { [rule]: { count: 1 } } });
	const lint = (text: string) => lintFindings(eslint, file, text, [rule]);
	const guard = async (text: string) => {
		const current = await lint(text);
		return guardEslintSuppressions({
			base: { [file]: { [rule]: { count: 1 } } },
			current: { [file]: { [rule]: { count: current[rule].length } } },
			baseFindings: { [file]: await lint(source) },
			currentFindings: { [file]: current },
			fileExists: () => true
		});
	};

	test('the fixture file still holds exactly the accepted assertion', async () => {
		expect(await lint(source)).toEqual({ [rule]: ['flows.find((f)=>f.id===strom)!'] });
	});

	test('fails when a new assertion replaces the accepted one at count 1', async () => {
		const swapped = source
			.replace(accepted, 'flows.find((f) => f.id === strom)?.name')
			.replace('\t\tkey,\n', '\t\tkey: key!,\n');
		expect(swapped).toContain('key: key!');
		expect(await guard(swapped)).toEqual({
			growth: [`${file} ${rule}: new finding \`key!\` (0 -> 1)`],
			stale: []
		});
	});

	test('passes when the accepted assertion only moves or is rewrapped', async () => {
		const shifted = `// shift\n\n${source}`.replace(
			accepted,
			'flows.find(\n(f) => f.id === strom\n)!.name'
		);
		expect(shifted).not.toContain(accepted);
		expect(await guard(shifted)).toEqual({ growth: [], stale: [] });
	});

	test('passes when the accepted assertion is removed', async () => {
		const fixed = source.replace(accepted, 'flows.find((f) => f.id === strom)?.name');
		expect(await lint(fixed)).toEqual({ [rule]: [] });
		expect(await guard(fixed)).toEqual({ growth: [], stale: [] });
	});

	test('fails closed on source ESLint cannot parse', async () => {
		await expect(lint('const = ;')).rejects.toThrow('eslint cannot lint');
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
