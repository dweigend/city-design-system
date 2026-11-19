// Base ref for every baseline growth check (Fallow, dependency-cruiser, ESLint).
// CI passes an immutable commit in BASELINE_BASE; locally the merge-base with
// the main branch is used, so a branch is always measured against where it forked.
const ENV_NAME = 'BASELINE_BASE';
const MAIN_CANDIDATES = ['origin/main', 'main'];

function git(args: string[]): { ok: boolean; out: string } {
	const { exitCode, stdout } = Bun.spawnSync(['git', ...args], { stderr: 'ignore' });
	return { ok: exitCode === 0, out: stdout.toString().trim() };
}

/** Resolves a ref to its commit SHA, or throws when git cannot resolve it. */
function commitOf(ref: string): string {
	const { ok, out } = git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
	if (!ok || !out) throw new Error(`${ENV_NAME}: cannot resolve "${ref}" to a commit`);
	return out;
}

/** Merge-base of HEAD with the first main-branch ref that exists, or undefined. */
function mainMergeBase(): string | undefined {
	for (const ref of MAIN_CANDIDATES) {
		const { ok, out } = git(['merge-base', 'HEAD', ref]);
		if (ok && out) return out;
	}
	return undefined;
}

/**
 * Returns the commit SHA that baseline files are compared against.
 * Uses `BASELINE_BASE` when set; in CI it is required, locally it falls back to
 * the merge-base of HEAD with `origin/main` or `main`. Throws when nothing resolves.
 */
export function resolveBaselineBase(env: Record<string, string | undefined> = process.env): string {
	const explicit = env[ENV_NAME]?.trim();
	if (explicit) return commitOf(explicit);
	if (env.CI) throw new Error(`${ENV_NAME} must be set in CI to an immutable base commit`);
	const fallback = mainMergeBase();
	if (!fallback) throw new Error(`${ENV_NAME} unset and no merge-base with main found`);
	return fallback;
}

/** Reads a file as it exists at `ref`, or undefined when the file is absent there. */
export function readAtRef(ref: string, path: string): string | undefined {
	const { ok, out } = git(['show', `${ref}:${path}`]);
	return ok ? out : undefined;
}
