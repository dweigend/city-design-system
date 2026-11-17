import { existsSync, readFileSync } from 'node:fs';
import { readAtRef, resolveBaselineBase } from './baseline-base';
import {
	guardCruiseBaseline,
	guardEslintSuppressions,
	type CruiseViolation,
	type GuardResult
} from './baseline-guards';

// Shrink-only gate for the dependency-cruiser baseline and ESLint suppressions
// (C-64): fails on growth against the base ref and on stale entries.
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

function eslintGuard(base: string): GuardResult {
	return guardEslintSuppressions({
		base: readJson(readAtRef(base, ESLINT_SUPPRESSIONS), {}),
		current: readJson(readFileSync(ESLINT_SUPPRESSIONS, 'utf8'), {}),
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

const base = resolveBaselineBase();
console.log(`baseline base ${base}`);
const cruisePassed = report(CRUISE_BASELINE, cruiseGuard(base));
const eslintPassed = report(ESLINT_SUPPRESSIONS, eslintGuard(base));
process.exitCode = cruisePassed && eslintPassed ? 0 : 1;
