// Pure comparisons behind check-baselines.ts. A baseline may only shrink:
// growth = an entry, count or suppressed finding the base ref does not have;
// stale = an entry the tools no longer produce. No I/O here, so the rules are unit-testable.

/** One dependency-cruiser violation as stored in `.dependency-cruiser-baseline.json`. */
export type CruiseViolation = {
	from: string;
	to: string;
	rule: { name: string };
	cycle?: Array<{ name: string }>;
	via?: Array<{ name: string }>;
};

/** `eslint-suppressions.json`: file -> rule -> suppressed count. */
export type EslintSuppressions = Record<string, Record<string, { count: number }>>;

/** Growth and stale entries found by one guard; both must be empty to pass. */
export type GuardResult = { growth: string[]; stale: string[] };

function names(modules: Array<{ name: string }>): string {
	return modules
		.map(({ name }) => name)
		.toSorted()
		.join(',');
}

/**
 * Identity of a violation, matching dependency-cruiser's own `isSameViolation`:
 * cycles by rule and member set, `via` paths by rule, ends and members, else rule and ends.
 */
export function violationKey(violation: CruiseViolation): string {
	const rule = violation.rule.name;
	if (violation.cycle) return `${rule} cycle[${names(violation.cycle)}]`;
	const via = violation.via ? ` via[${names(violation.via)}]` : '';
	return `${rule} ${violation.from} -> ${violation.to}${via}`;
}

function keySet(violations: CruiseViolation[]): Set<string> {
	return new Set(violations.map(violationKey));
}

/** Compares the dependency-cruiser baseline with its base version and the violations produced now. */
export function guardCruiseBaseline(input: {
	base: CruiseViolation[];
	baseline: CruiseViolation[];
	produced: CruiseViolation[];
}): GuardResult {
	const base = keySet(input.base);
	const produced = keySet(input.produced);
	const baseline = [...keySet(input.baseline)];
	return {
		growth: baseline.filter((key) => !base.has(key)),
		stale: baseline.filter((key) => !produced.has(key))
	};
}

/**
 * Suppressed findings by identity: file -> rule -> one text per finding, as
 * `findingText` returns it. Repeated texts are separate findings.
 */
export type SuppressedFindings = Record<string, Record<string, string[]>>;

/** Source range of one ESLint message: 1-based lines and columns, end exclusive. */
export type FindingRange = { line: number; column: number; endLine?: number; endColumn?: number };

/**
 * Identity text of a finding: the reported source range without whitespace, so
 * it survives line shifts and reformatting. A message without an end covers
 * the rest of its line.
 */
export function findingText(source: string, range: FindingRange): string {
	const lines = source.split('\n');
	const offset = (line: number, column: number) =>
		lines.slice(0, line - 1).reduce((sum, text) => sum + text.length + 1, column - 1);
	const end =
		range.endLine === undefined || range.endColumn === undefined
			? offset(range.line + 1, 0)
			: offset(range.endLine, range.endColumn);
	return source.slice(offset(range.line, range.column), end).replace(/\s+/g, '');
}

function tally(texts: string[] = []): Map<string, number> {
	const counts = new Map<string, number>();
	for (const text of texts) counts.set(text, (counts.get(text) ?? 0) + 1);
	return counts;
}

/** Findings that occur more often now than at the base ref, one line per identity. */
function newFindings(base: string[] | undefined, current: string[] | undefined): string[] {
	const before = tally(base);
	return [...tally(current)]
		.filter(([text, count]) => count > (before.get(text) ?? 0))
		.map(([text, count]) => `new finding \`${text}\` (${before.get(text) ?? 0} -> ${count})`);
}

function suppressedCount(suppressions: EslintSuppressions, file: string, rule: string): number {
	return suppressions[file]?.[rule]?.count ?? 0;
}

/** Inputs of the ESLint suppression guard: both suppression files and the findings behind them. */
export type EslintGuardInput = {
	base: EslintSuppressions;
	current: EslintSuppressions;
	/** Findings in the base ref's sources for the rules suppressed there. */
	baseFindings: SuppressedFindings;
	/** Findings in the working tree for the rules suppressed now. */
	currentFindings: SuppressedFindings;
	fileExists: (file: string) => boolean;
};

/** Growth of one file/rule entry: a higher count, or a finding the base ref does not have. */
function entryGrowth(input: EslintGuardInput, file: string, rule: string): string[] {
	const before = suppressedCount(input.base, file, rule);
	const count = suppressedCount(input.current, file, rule);
	const fresh = newFindings(input.baseFindings[file]?.[rule], input.currentFindings[file]?.[rule]);
	return [...(count > before ? [`${before} -> ${count}`] : []), ...fresh].map(
		(entry) => `${file} ${rule}: ${entry}`
	);
}

/** Stale state of one file/rule entry: more suppressions than ESLint reports findings. */
function entryStale(input: EslintGuardInput, file: string, rule: string): string[] {
	const count = suppressedCount(input.current, file, rule);
	const reported = input.currentFindings[file]?.[rule]?.length ?? 0;
	return count > reported ? [`${file} ${rule}: count ${count}, eslint reports ${reported}`] : [];
}

/**
 * Compares ESLint suppressions with their base version by finding identity
 * (file, rule, `findingText`, with multiplicity), not only by count. Growth is
 * a higher count or a finding the base ref lacks, so a new violation cannot
 * take the place of a removed one. Removing a finding or shifting its lines
 * passes. Stale is an entry whose file no longer exists or whose count exceeds
 * the findings ESLint reports.
 */
export function guardEslintSuppressions(input: EslintGuardInput): GuardResult {
	const growth: string[] = [];
	const stale: string[] = [];
	for (const [file, rules] of Object.entries(input.current)) {
		if (!input.fileExists(file)) stale.push(`${file}: file does not exist`);
		for (const rule of Object.keys(rules)) {
			growth.push(...entryGrowth(input, file, rule));
			if (input.fileExists(file)) stale.push(...entryStale(input, file, rule));
		}
	}
	return { growth, stale };
}
