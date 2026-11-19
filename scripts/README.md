# Scripts

Repository tooling that runs under Bun, outside the app bundle. App code lives in `src/`; nothing here is shipped to the browser.

## Quality gate

`bun run verify` runs every gate and must exit 0 before a change counts as done.

| Script                                                         | Command                          | Checks                                                                                    |
| -------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------- |
| `verify.ts`                                                    | `bun run verify`                 | Runs lint, check, test, test:perf, boundaries, Fallow, private skills and build in order. |
| `test-perf.ts`                                                 | `bun run test:perf`              | Runs each performance test file in a fresh process, one at a time.                        |
| `check-boundaries.ts`                                          | `bun run check:boundaries`       | Runtime and type import boundaries between catalog layers.                                |
| `check-svelte-type-boundaries.ts`, `svelte-type-boundaries.ts` | `bun run check:boundaries:types` | Type-only imports in Svelte and TypeScript files.                                         |
| `svelte-type-boundaries.test.ts`, `fixtures/`                  | `bun test`                       | Cases for the type boundary check.                                                        |
| `check-fallow.ts`                                              | `bun run check:fallow`           | Dead code, complexity and duplication against `.fallow-baselines/`.                       |
| `check-private-skills.ts`                                      | `bun run check:skills`           | No private skills tracked in git.                                                         |

## Manual

| Script                   | Command                     | Purpose                                                                                                                                                                          |
| ------------------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `review.ts`              | `bun run review`            | Prints Fallow reports, then runs `verify`.                                                                                                                                       |
| `statik-vorberechnen.ts` | `bun run precompute:statik` | Precomputes the structural form finding into `src/lib/catalog/data/vorberechnet/`. Run after changing the generator; `hausAuftrag.test.ts` fails while the stored file is stale. |
