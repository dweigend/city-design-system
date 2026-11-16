# Tooling Baseline

As of 2026-11-12. No changes to application code. Parallel work can change numbers.

| Tool                       | Version / Baseline                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Fallow                     | 3.42.0, exact pinned; health: 116 over threshold, 2,542 functions, Maintainability 89.1                                   |
| Fallow dead-code           | 3 files, 47 exports, 5 types, 2 duplicate export pairs, 1 cycle                                                           |
| Fallow dupes               | 717 lines (2.1%) in 42 files                                                                                              |
| dependency-cruiser         | 18.7.2, exact pinned; 15 legacy findings: 11 data→logic, 3 renderer imports, 1 cycle                                      |
| ESLint / typescript-eslint | 10.14.0 / 8.72.2; 325 non-null assertions, 0 explicit-any; 75 complexity, 40 max-lines warnings                           |
| Bun test                   | 180 passed, 0 failed, 14 files; before and after setup                                                                    |
| TypeScript                 | `noImplicitOverride` and `noFallthroughCasesInSwitch` active: `check` without errors/warnings                             |
| TypeScript measurement     | `tsc --noEmit`: 0; additionally `noUncheckedIndexedAccess`: 1,405, `exactOptionalPropertyTypes`: 41 diagnostics; both off |

Scripts: `test`, `analyze:health`, `analyze:unused`, `analyze:duplication`, `check:boundaries`, `review`.
`review` executes all reports and gates sequentially; report exit codes are displayed, gate failures exit with code 1.
Blocking: `check`, `lint` (including Prettier), `test`, `build`, and new boundary violations. Sizes/complexity and Fallow remain report-only.
ESLint counts legacy assertions in `eslint-suppressions.json` per file/rule; additional assertions become errors. Reduction during contract work per 103 Step 1; no blanket disablement.
Limitation of the suppression baseline: `eslint-suppressions.json` holds 325 entries across 60 files, all `no-non-null-assertion`, only as counts per file and rule. The count is checked, not the location. If an old assertion is removed and a new one is added, the count remains the same; the swap goes unnoticed. Therefore, inspect reduction and new invariants separately in review ([109](review.md)).
Open: the baseline contains 5 assertions from `src/lib/catalog/logic/modellierung/` (`netz.ts` 1, `universal.ts` 2, `wachstum.ts` 2). The page was unfinished and untracked during setup. Thus new code was counted as legacy stock; this contradicts "additional assertions become errors." Not cleaned up: decision and reduction are pending.
Boundary baseline: `.dependency-cruiser-baseline.json`. The Universal cycle remains visible; removal per 103 Step 2. ~~data→logic also affects tests~~ (corrected on 2026-11-16, see addendum below); renderer in `data/city3d.ts` requires a separate owner decision (103 Current-State Analysis Data/Renderer), not an automatic exemption for whole folders.
Negative probes deleted: `style` block, `style` attribute, `SvelteStyleDirective` each produce ESLint errors; `logic→scene/WeltView.svelte` produces a `headless-core` error despite the baseline.
Fallow uses SvelteKit/Svelte detection and TS/package-import resolution for `$lib`/`#lib`; routes are explicit entry points, components are traced via imports, not blindly declared alive.
Excluded: `.svelte-kit`, `build`, `static`, `docs`. Fallow reports partially ineffective ignore globs for this; intentionally retained for later hardening.
Dead-code is not proof of deletion: public catalog exports and dynamically selected components require usage verification. The known Universal cycle is correctly found. Complete alias/dynamic resolution is not proven by that.
Sign-off: `check`, `test`, `build` passed; `lint` fails on existing/parallel-edited formatting files. Separate ESLint also reports one `no-unused-vars` and one `no-useless-assignment` error each. No external code formatted.
Source: [Fallow documentation](https://fallow.tools/docs/) and locally verified CLI help; `health`, `dead-code`, and `dupes` commands exist.

## Addendum 2026-11-14 · Svelte Type Edges

`check:boundaries` now runs `check:boundaries:runtime` (previous dependency-cruiser gate with unchanged baseline) and `check:boundaries:types`. Both run even if the other fails. `review` continues to use the combined gate.

The addition reads explicit type imports and type re-exports from both Svelte script contexts via AST and adds missing edges to the full dependency-cruiser graph. It checks exclusively for additional violations against existing rules, including cycles across TypeScript and multiple Svelte type-only edges. Resolution errors abort. Positive and negative fixtures live in `scripts/svelte-type-boundaries.test.ts`; current coverage and limitations are in [ARCHITECTURE](../ARCHITECTURE.md#import-matrix). No rule change, no expansion of the boundary baseline, and no decision on classifying tests under `data/`.

## Addendum 2026-11-16 · Tests as `dev` Layer

`*.test.ts` belongs to `dev` regardless of folder and is therefore not subject to `data-no-logic` or `headless-core`. The earlier statement "data→logic also affects tests" no longer applies. `no-runtime-to-dev` blocks imports from non-dev files into `*.test.ts` and `benchmark.ts`, including type imports. The executable positive and negative probes live in `scripts/svelte-type-boundaries.test.ts`; the decision is in the [decision register](../README.md#decided), the contract in [A-27](../ARCHITECTURE.md#import-matrix).

The boundary baseline loses exclusively the two outdated `data-no-logic` findings from `data/color.test.ts`. All other entries remain unchanged; no entries are added.
