# Scripts

Repository tooling that runs under Bun, outside the app bundle. App code lives in `src/`; nothing here is shipped to the browser.

## Quality gate

`bun run verify` runs every gate and must exit 0 before a change counts as done.

| Script                                                                | Command                          | Checks                                                                                                                                               |
| --------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verify.ts`                                                           | `bun run verify`                 | Runs lint, check, test, boundaries, Fallow, private skills, baselines and build in order.                                                            |
| `check-boundaries.ts`                                                 | `bun run check:boundaries`       | Runtime and type import boundaries between catalog layers.                                                                                           |
| `check-svelte-type-boundaries.ts`, `svelte-type-boundaries.ts`        | `bun run check:boundaries:types` | Type-only imports in Svelte and TypeScript files.                                                                                                    |
| `svelte-type-boundaries.test.ts`, `fixtures/`                         | `bun test`                       | Cases for the type boundary check.                                                                                                                   |
| `check-fallow.ts`                                                     | `bun run check:fallow`           | Dead code, complexity and duplication against `.fallow-baselines/`.                                                                                  |
| `check-private-skills.ts`                                             | `bun run check:skills`           | No private skills tracked in git.                                                                                                                    |
| `check-baselines.ts`, `baseline-guards.ts`, `baseline-guards.test.ts` | `bun run check:baselines`        | `.dependency-cruiser-baseline.json` and `eslint-suppressions.json` only shrink: fails on an entry or count the base ref lacks, and on stale entries. |
| `baseline-base.ts`                                                    | —                                | Base ref for every growth check (Fallow included): `BASELINE_BASE`, required in CI; locally the merge-base of HEAD with `origin/main` or `main`.     |

### Baseline rules

- No baseline can grow through CI: there is no exception flag and no ruleset bypass. A moved or renamed file counts as new, so the move fixes its finding first. An owner-approved exception (C-64) needs an explicit change to the gate, reviewed by the merge council.

- Growth is measured against `BASELINE_BASE`. CI sets it to the first parent of the pull request merge commit (the exact `main` commit the PR merges into), or to `github.event.before` on a push to `main`. Locally it defaults to the merge-base with `origin/main`; fetch first, because a stale `origin/main` gives an older base, and on `main` itself without `origin/main` the base is `HEAD`, so committed growth is only caught in CI.
- dependency-cruiser entries match by rule and ends (cycles by member set), as dependency-cruiser does. Stale means `depcruise` no longer produces the entry.
- ESLint suppressions are counts per file and rule. Growth means a new file/rule entry or a higher count. Replacing one suppressed violation with another in the same file and rule passes; that is accepted. Unused counts fail `eslint` itself (ESLint 10 exits 2 unless `--pass-on-unpruned-suppressions`); the guard adds entries whose file no longer exists.

## Gate probes

`bun run probe:gates [name-prefix ...]` (`probe-gates.ts`, `probe-cases.ts`, `probe-sandbox.ts`) proves that each gate fails on an injected violation: Prettier, ESLint rule, unused ESLint suppression, type check, unit test, import boundary, Fallow, private skills, and growth and stale entries for both baseline guards. A probe passes only when the gate exits non-zero and its output names the injected violation. Each probe runs in a temporary copy of the working tree (tracked plus untracked, non-ignored files) with `node_modules` symlinked and a fresh git repository; the real worktree and git index are untouched. It takes about a minute, so it is not part of `bun test` or `verify`; run it after changing a gate.

## Worktree setup

`bun run bootstrap` (`bootstrap-worktree.ts`) prepares a fresh worktree: it checks that bun matches the pin in `.github/workflows/verify.yml`, runs `bun install --frozen-lockfile` and `svelte-kit sync`, prints branch, upstream and status, and suggests a free dev port from 5190 on. Port 5180 is the shared preview and is never suggested. Nothing outside the worktree changes.

## CI and branch protection

`.github/workflows/verify.yml` runs on pull requests to `main` and pushes to `main`: bun 1.4.4, frozen install, `bun run verify`, then Playwright Chromium and `bun run test:browser`. Its job `verify` is the required status check.

`.github/rulesets/main.json` protects `main`: pull request required (0 approvals), `verify` from GitHub Actions (integration 15368) required and up to date, no force push, no deletion, merge commits only (no squash or rebase merges, GW-31), linear history not required. It covers `main` only; `experimente` stays force-pushable for its rebase (GW-32). Apply it only after the workflow is on `main` and has reported `verify` once; otherwise every pull request waits for a check that never runs:

```sh
gh api --method POST repos/dweigend/city-design-system/rulesets --input .github/rulesets/main.json
```

To update an applied ruleset, look up its id with `gh api repos/dweigend/city-design-system/rulesets` and use `gh api --method PUT repos/dweigend/city-design-system/rulesets/<id> --input .github/rulesets/main.json`.

## Manual

| Script                   | Command                     | Purpose                                                                                                                                                                          |
| ------------------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `review.ts`              | `bun run review`            | Prints Fallow reports, then runs `verify`.                                                                                                                                       |
| `statik-vorberechnen.ts` | `bun run precompute:statik` | Precomputes the structural form finding into `src/lib/catalog/data/vorberechnet/`. Run after changing the generator; `hausAuftrag.test.ts` fails while the stored file is stale. |
| `probe-gates.ts`         | `bun run probe:gates`       | Negative probes for every gate; see Gate probes.                                                                                                                                 |
| `bootstrap-worktree.ts`  | `bun run bootstrap`         | Fresh worktree setup; see Worktree setup.                                                                                                                                        |
