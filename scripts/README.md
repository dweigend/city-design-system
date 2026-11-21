# Scripts

Repository tooling that runs under Bun, outside the app bundle. App code lives in `src/`; nothing here is shipped to the browser.

## Quality gate

`bun run verify` runs every gate and must exit 0 before a change counts as done.

| Script                                                                | Command                          | Checks                                                                                                                                                                          |
| --------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verify.ts`                                                           | `bun run verify`                 | Runs lint, check, test, test:perf, boundaries, Fallow, private skills, baselines and build in order.                                                                            |
| `test-perf.ts`                                                        | `bun run test:perf`              | Runs one performance test file per process, in order.                                                                                                                           |
| `check-boundaries.ts`                                                 | `bun run check:boundaries`       | Runtime and type import boundaries between catalog layers.                                                                                                                      |
| `check-svelte-type-boundaries.ts`, `svelte-type-boundaries.ts`        | `bun run check:boundaries:types` | Type-only imports in Svelte and TypeScript files.                                                                                                                               |
| `svelte-type-boundaries.test.ts`, `fixtures/`                         | `bun test`                       | Cases for the type boundary check.                                                                                                                                              |
| `check-fallow.ts`                                                     | `bun run check:fallow`           | Dead code, complexity and duplication against `.fallow-baselines/`.                                                                                                             |
| `check-private-skills.ts`                                             | `bun run check:skills`           | No private skills tracked in git.                                                                                                                                               |
| `check-baselines.ts`, `baseline-guards.ts`, `baseline-guards.test.ts` | `bun run check:baselines`        | `.dependency-cruiser-baseline.json` and `eslint-suppressions.json` only shrink: fails on an entry, count or suppressed ESLint finding the base ref lacks, and on stale entries. |
| `baseline-base.ts`                                                    | —                                | Base ref for every growth check (Fallow included): `BASELINE_BASE`, required in CI; locally the merge-base of HEAD with `origin/main` or `main`.                                |

### Baseline rules

- No baseline can grow through CI: there is no exception flag and no ruleset bypass. A moved or renamed file counts as new, so the move fixes its finding first. An owner-approved exception (C-64) needs an explicit change to the gate, reviewed by the merge council.

- Growth is measured against `BASELINE_BASE`. CI sets it to the first parent of the pull request merge commit (the exact `main` commit the PR merges into), or to `github.event.before` on a push to `main`. Locally it defaults to the merge-base with `origin/main`; fetch first, because a stale `origin/main` gives an older base, and on `main` itself without `origin/main` the base is `HEAD`, so committed growth is only caught in CI.
- dependency-cruiser entries match by rule and ends (cycles by member set), as dependency-cruiser does. Stale means `depcruise` no longer produces the entry.
- ESLint suppressions are stored as counts per file and rule, but the guard compares the findings behind them. It lints every suppressed file twice with the current ESLint config, restricted to the suppressed rules: once as it is in the working tree and once with its content at `BASELINE_BASE`. A finding is identified by file, rule and the token texts in the source range ESLint reports for it, preserving token boundaries and whitespace inside literals while ignoring formatting trivia, and identical texts are counted. Growth means a new file/rule entry, a higher count, or a finding that occurs more often than at the base, so a new violation cannot take the place of a removed one. Removing a suppressed finding passes, and so does moving or rewrapping it. Stale means the file no longer exists or the count exceeds the findings ESLint reports; `eslint` itself also fails on unused counts (ESLint 10 exits 2 unless `--pass-on-unpruned-suppressions`).
- Limits of that identity: editing the text of a suppressed finding (renaming a variable inside it) counts as new, so the edit fixes the finding. A new finding with exactly the text of one removed from the same file and rule passes. The base content is linted with the current config and, for type-aware rules, against the current types on disk; the only suppressed rule today, `no-non-null-assertion`, is syntactic.
- The guard runs from the checked-out tree. A pull request that changes `check-baselines.ts`, `baseline-guards.ts`, the ESLint config or the workflow redefines its own check, and CI cannot detect that. Review of such changes (merge council) is the only protection.

## Gate probes

`bun run probe:gates [name-prefix ...]` (`probe-gates.ts`, `probe-cases.ts`, `probe-sandbox.ts`) proves that each gate fails on an injected violation: Prettier, ESLint rule, unused ESLint suppression, type check, unit test, import boundary, Fallow, private skills, growth and stale entries for both baseline guards, and a suppressed ESLint finding swapped for a new one. A probe passes only when the gate exits non-zero and its output names the injected violation. Each probe runs in a temporary copy of the working tree (tracked plus untracked, non-ignored files) with `node_modules` symlinked and a fresh git repository; the real worktree and git index are untouched. It takes about a minute, so it is not part of `bun test` or `verify`; run it after changing a gate.

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

## Experiment delivery on davidserver

Run plain reads such as `rg`, `sed` and `git status` directly. They never go through `heavy-slot`. Each gate and browser process acquires its own exclusive slot.

From the clean package worktree, run the following command with the task ID and UTC start from its brief.

```sh
bun run ship <branch> --package <id> --started-at <ISO-timestamp> --reference /absolute/path/to/reference.png
```

Ship integrates the current experiment base into the package and checks the resulting tree. It runs lint, type checks, boundary and private-skill checks, then changed tests and tests that transitively import changed modules. It captures the base, merges with two parents, pushes to `experimente`, and captures that merge. Set `SHOT_ROUTE=/` before the ship command to capture only the home page on both revisions. A successful delivery records the UTC receipt in the sibling lab, appends its evidence line to `research/runde-2/belege.jsonl`, and removes the package checkout and local branch. Run the same command from the retained checkout to resume a failed capture while the same merge is live. A changed integration base requires a fresh gate. Ship defaults the package ID to the branch with slashes replaced by hyphens, and the start to delivery time if the brief supplies none.

```sh
heavy-slot --exclusive --mem 2G --time 600 --wait 900 -- bun run shot /sandbox/abnahme /sandbox/haus
```

Shot uses the running experiment checkout's preview on port 5181 and its opening scene in a fresh light-theme browser at DPR 1 with reduced motion. Chrome treats the verified preview origin as secure for that browser session so WebGPU is available over HTTP. Its three default routes open at seed 7. Supply a route with its query string to capture another supported seed or view. Each route gets a 390 × 844 and a 1280 × 640 sheet. The manifest records the revision, viewport and actual canvas backend and adapter. The first capture labels the missing before panel. Later runs look for a matching first-parent capture. Set `--before <shot-folder>` to specify it explicitly. Ship also accepts this option to reuse an existing base capture. The default style reference is the approved image-workflow reference in the lab.
