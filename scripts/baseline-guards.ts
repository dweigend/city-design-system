// Pure comparisons behind check-baselines.ts. A baseline may only shrink:
// growth = an entry or count the base ref does not have; stale = an entry the
// tools no longer produce. No I/O here, so the rules are unit-testable.

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

function suppressedCount(suppressions: EslintSuppressions, file: string, rule: string): number {
	return suppressions[file]?.[rule]?.count ?? 0;
}

/**
 * Compares ESLint suppressions with their base version. Growth is a new
 * file/rule entry or a higher count. Stale here means the file no longer
 * exists; unused counts in existing files already fail `eslint` itself.
 */
export function guardEslintSuppressions(input: {
	base: EslintSuppressions;
	current: EslintSuppressions;
	fileExists: (file: string) => boolean;
}): GuardResult {
	const growth: string[] = [];
	for (const [file, rules] of Object.entries(input.current)) {
		for (const [rule, { count }] of Object.entries(rules)) {
			const before = suppressedCount(input.base, file, rule);
			if (count > before) growth.push(`${file} ${rule}: ${before} -> ${count}`);
		}
	}
	const stale = Object.keys(input.current).filter((file) => !input.fileExists(file));
	return { growth, stale: stale.map((file) => `${file}: file does not exist`) };
}
