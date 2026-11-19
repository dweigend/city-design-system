import { ESLint } from 'eslint';
import { existsSync, readFileSync } from 'node:fs';
import { readAtRef, resolveBaselineBase } from './baseline-base';
import {
	findingText,
	guardCruiseBaseline,
	guardEslintSuppressions,
	type CruiseViolation,
	type EslintSuppressions,
	type GuardResult,
	type SuppressedFindings
} from './baseline-guards';

// Shrink-only gate for the dependency-cruiser baseline and ESLint suppressions
// (C-64): fails on growth against the base ref and on stale entries. ESLint
// suppressions are compared by finding identity: the suppressed files are
// linted as they are now and as they were at the base ref.
const CRUISE_BASELINE = '.dependency-cruiser-baseline.json';
const ESLINT_SUPPRESSIONS = 'eslint-suppressions.json';

function readJson<T>(text: string | undefined, fallback: T): T {
	return text === undefined ? fallback : (JSON.parse(text) as T);
}

/** Violations dependency-cruiser produces now, ignoring the baseline. */
function producedViolations(): CruiseViolation[] {
	const command = ['bunx', 'depcruise', 'src', '--config', '.dependency-cruiser.cjs'];
	const { exitCode, stdout, stderr } = Bun.spawnSync([...command, '--output-type', 'baseline']);
	if (exitCode !== 0) throw new Error(`depcruise failed (exit ${exitCode}):\n${stderr.toString()}`);
	return JSON.parse(stdout.toString()) as CruiseViolation[];
}

function cruiseGuard(base: string): GuardResult {
	return guardCruiseBaseline({
		base: readJson(readAtRef(base, CRUISE_BASELINE), []),
		baseline: readJson(readFileSync(CRUISE_BASELINE, 'utf8'), []),
		produced: producedViolations()
	});
}

/** ESLint restricted to the rules that any of the suppression files names. */
export function suppressionLinter(...files: EslintSuppressions[]): ESLint {
	const rules = new Set(files.flatMap((file) => Object.values(file).flatMap(Object.keys)));
	return new ESLint({ ruleFilter: ({ ruleId }) => rules.has(ruleId) });
}

/**
 * Identity texts of the findings ESLint reports in `text` for `rules`, by rule.
 * The Node API does not apply `eslint-suppressions.json`, so suppressed findings
 * are reported. `file` must exist on disk for the typed parser; throws when
 * ESLint ignores the file or cannot parse `text`.
 */
export async function lintFindings(
	eslint: ESLint,
	file: string,
	text: string,
	rules: string[]
): Promise<Record<string, string[]>> {
	const [result] = await eslint.lintText(text, { filePath: file });
	const fatal = result ? result.messages.find((message) => message.fatal) : undefined;
	if (!result || fatal)
		throw new Error(`eslint cannot lint ${file}: ${fatal?.message ?? 'ignored'}`);
	const texts = (rule: string) =>
		result.messages.filter(({ ruleId }) => ruleId === rule).map((at) => findingText(text, at));
	return Object.fromEntries(rules.map((rule) => [rule, texts(rule)]));
}

/** Findings behind each suppression entry whose file exists now, with sources from `read`. */
async function suppressedFindings(
	eslint: ESLint,
	suppressions: EslintSuppressions,
	read: (file: string) => string | undefined
): Promise<SuppressedFindings> {
	const findings: SuppressedFindings = {};
	for (const [file, rules] of Object.entries(suppressions)) {
		const text = existsSync(file) ? read(file) : undefined;
		if (text !== undefined)
			findings[file] = await lintFindings(eslint, file, text, Object.keys(rules));
	}
	return findings;
}

async function eslintGuard(base: string): Promise<GuardResult> {
	const before: EslintSuppressions = readJson(readAtRef(base, ESLINT_SUPPRESSIONS), {});
	const current: EslintSuppressions = readJson(readFileSync(ESLINT_SUPPRESSIONS, 'utf8'), {});
	const eslint = suppressionLinter(before, current);
	const atBase = (file: string) => (file in current ? readAtRef(base, file) : undefined);
	return guardEslintSuppressions({
		base: before,
		current,
		baseFindings: await suppressedFindings(eslint, before, atBase),
		currentFindings: await suppressedFindings(eslint, current, (file) =>
			readFileSync(file, 'utf8')
		),
		fileExists: (file) => existsSync(file)
	});
}

/** Prints one guard's findings; returns true when it passes. */
function report(file: string, { growth, stale }: GuardResult): boolean {
	const lines = [
		...growth.map((entry) => `${file} growth: ${entry}`),
		...stale.map((entry) => `${file} stale: ${entry}`)
	];
	lines.forEach((line) => console.error(line));
	console.log(file, lines.length === 0 ? 'pass' : `FAIL (${lines.length} entries)`);
	return lines.length === 0;
}

/** Runs both guards against the resolved base ref and sets the exit code. */
async function main(): Promise<void> {
	const base = resolveBaselineBase();
	console.log(`baseline base ${base}`);
	const cruisePassed = report(CRUISE_BASELINE, cruiseGuard(base));
	const eslintPassed = report(ESLINT_SUPPRESSIONS, await eslintGuard(base));
	process.exitCode = cruisePassed && eslintPassed ? 0 : 1;
}

if (import.meta.main) await main();
