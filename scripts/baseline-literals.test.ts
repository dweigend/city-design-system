import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { findingText, guardEslintSuppressions } from './baseline-guards';
import { lintFindings, suppressionLinter } from './check-baselines';

const identity = (source: string) =>
	findingText(source, { line: 1, column: 1, endLine: 1, endColumn: source.length + 1 });

test.each([
	["lookup('rim 0')!", "lookup('rim0')!"],
	['lookup(`rim ${id} x`)!', 'lookup(`rim${id}x`)!'],
	['lookup(/rim 0/)!', 'lookup(/rim0/)!'],
	['a + +b', 'a++ + b']
])('finding identities distinguish %s from %s', (first, second) => {
	expect(identity(first)).not.toBe(identity(second));
});

test('formatting and comments outside tokens preserve identity', () => {
	expect(identity("lookup( /* reason */ 'rim 0' ) !")).toBe(identity("lookup('rim 0')!"));
});

test('a literal change cannot inherit a removed assertion suppression', async () => {
	const file = 'src/lib/catalog/logic/parametrik/eckraster/state.ts';
	const rule = '@typescript-eslint/no-non-null-assertion';
	const source = readFileSync(file, 'utf8');
	const accepted = "p.vertices.find((v) => v.id === 'rim0')!.id";
	expect(source).toContain(accepted);
	const changed =
		source.replace(accepted, accepted.replace('!.id', '?.id')) +
		"\nfunction replacement(p: Patch) { return p.vertices.find((v) => v.id === 'rim 0')!.id; }\n";
	const suppressions = { [file]: { [rule]: { count: 1 } } };
	const eslint = suppressionLinter(suppressions);
	const before = await lintFindings(eslint, file, source, [rule]);
	const after = await lintFindings(eslint, file, changed, [rule]);
	expect(before[rule]).toHaveLength(1);
	expect(after[rule]).toHaveLength(1);
	const result = guardEslintSuppressions({
		base: suppressions,
		current: suppressions,
		baseFindings: { [file]: before },
		currentFindings: { [file]: after },
		fileExists: () => true
	});
	expect(result.growth).toHaveLength(1);
	expect(result.growth[0]).toContain('rim 0');
	expect(result.stale).toEqual([]);
});
