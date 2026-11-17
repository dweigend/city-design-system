# Design Bible Standards

As of 2026-11-14. **Draft.** Author sign-off remains open. These files establish rules. They do not serve as proof of implementation.

The goal remains the design bible as a SvelteKit website. It generates a city procedurally. Therefore it requires binding rules for mathematics, code, architecture, and documentation. The foundation is the standards of the sister repository `city-library`. They apply here in full in their domain intent, translated to the catalog, bible pages, labs, demos, and scenes. The library is read-only and never modified.

The derivation from the city library lives in the private design lab.

## Precedence

1. Explicit decision by David. The most recent one governs.
2. [AGENTS.md](../../AGENTS.md).
3. The domain standards below. Every fact has exactly one owner; all other places link to it.
4. `docs/research/`: evidence and rationale, not a contract.
5. Library originals: source. The translated version governs here.

If two rules contradict each other, the conflict is reported and not resolved silently.

## Documents and Single Source of Truth

| File                                                     | Owner for                                                                               | Rule IDs                  |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------- |
| [CODING_STANDARDS.md](CODING_STANDARDS.md)               | Priorities, readability, types, validation, state, reference code, refactoring          | `C-`                      |
| [ARCHITECTURE.md](ARCHITECTURE.md)                       | Layers, import matrix, public contracts, modules, ownership, current deviations         | `A-`                      |
| [NAMING_CONVENTIONS.md](NAMING_CONVENTIONS.md)           | Language, glossary, casing, verbs, units in names, type roles                           | `NC-`                     |
| [GLOSSARY.md](GLOSSARY.md)                               | Binding English–German domain terminology and code mapping                              | —                         |
| [PROCEDURAL_PRINCIPLES.md](PROCEDURAL_PRINCIPLES.md)     | Determinism, coordinates, numerics, topology, projection, budgets, and measurement duty | `PD- PE- PN- PT- PP- PB-` |
| [DESIGN_STANDARDS.md](DESIGN_STANDARDS.md)               | UI stack, tokens, color and material, CSS boundaries, accessibility, browser sign-off   | `DS-`                     |
| [DOCUMENTATION_STANDARDS.md](DOCUMENTATION_STANDARDS.md) | Bible pages, research, experiments, comparison plates, sources, frozen evidence         | `DOC-`                    |
| [git-workflow.md](../development/git-workflow.md)        | Authorization, branches, commits, delivery, cleanup                                     | `GW-`                     |
| This file                                                | Precedence, legend, roles and review, verification commands, decision register          | —                         |

## Legend

**Authority** of a rule:

- **D** – set by David. Evidenced in AGENTS.md, in the color contract, in the library sections "The principles," "Consequences," and the accepted structure, or in the brief of 2026-11-12.
- **N** – Norm. Applicable documentation of the library or this project without a separately documented author decision. Library norms bind here through David's transfer decision.
- **V** – Proposal. Applies as a working rule until David decides.
- An asterisk (`N*`, `D*`) means: adapted translation. The source carries the stated authority; the adaptation is a proposal until sign-off.
- **Decision open** – David decides. Until then, the stated default applies.

**Sources** (library paths refer to the sister repository; `§` names the start of a heading or a named list item in the source):

| Abbrev.        | Source                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------- |
| CS             | `city-library/docs/CODING_STANDARDS.md`                                                     |
| AR             | `city-library/docs/ARCHITECTURE.md`                                                         |
| NC             | `city-library/docs/NAMING_CONVENTIONS.md`                                                   |
| UI             | `city-library/docs/DESIGN.md`                                                               |
| PR             | `city-library/docs/evolution/principles.md`; only "The principles" and "Consequences" are D |
| ST             | `city-library/docs/evolution/structure.md`; accepted on 2026-11-11, not yet migrated there  |
| RF             | `city-library/docs/evolution/refactoring.md`; predominantly proposal                        |
| GW             | `city-library/docs/development/git-workflow.md`                                             |
| PL             | `city-library/PLAN.md`; example-first and reviews                                           |
| LA             | `city-library/AGENTS.md`                                                                    |
| SK             | local library skills under `city-library/.agents/skills/` including `references/`           |
| AG             | [AGENTS.md](../../AGENTS.md) of this repo (project rule)                                    |
| 95, 96         | `docs/research/01-universal-grid.md`, `docs/research/02-geometry-principles.md`             |
| KE, K3, GE, SG | measurement reports in the private design lab                                               |
| Code           | location in this repo                                                                       |

## Roles and Review

Set by David (2026-11-12, extended 2026-11-17). Model assignment per task: local skill `model-routing`, which links here.

- Implementer and reviewer are always different agents, from different model families. Self-review is not a sign-off.
- Opus 5.5 orchestrates, designs and implements; GPT-6.1 Sol is the implementation workhorse; in the Sol loop it is the reviewer at fixed low reasoning, without automatic escalation, while the implementing agent answers its findings. A Sol review of Sol-built code is a same-family check, not the independent review; GPT-6 Luna takes routine chores. Never Haiku.
- Critical changes (CI, workflows, build configuration, secrets): specialist review by Fable 5.2. Independent reviews and sign-off: GPT-6 Astra.
- **Merge council for `main`:** two independent, mandatory reviews, one from a Claude model and one from a Codex model. A smaller Antigravity review is optional and never blocks. The Claude reviewer is never the implementing agent; for a change built by a Claude model the Codex review provides the different-family review. The council reports findings; merging stays David's decision (GW-02).
- Quota exhaustion, timeouts or reaching a round limit are never an approval. Sign-off stays open.
- Critical or ambiguous decisions go to David; no agent settles them.
- No silent substitution. If a model is unavailable, sign-off remains open.
- Independent browser sign-off on screenshots ([DS-71](DESIGN_STANDARDS.md#browser-and-screenshot-sign-off)) may be done by GPT-6.1 Sol.
- Findings and responses are recorded separately from sign-off.
- Reviews report only real issues (AGENTS.md, "Code Review Rules"). Size and complexity numbers are hints, not findings.

### Working Method

- **Root cause first.** Reproduce the defect, explain its cause, then fix it there. Simplify or refactor when that removes the cause; a trivial cause needs no refactor. No stacked workarounds for symptoms.
- **Browser evidence decides UI questions.** Browser-facing changes and dependency updates are operated in a real browser and signed off on current screenshots ([DS-70–DS-73](DESIGN_STANDARDS.md#browser-and-screenshot-sign-off)). Evidence names the candidate exactly: commit SHA and uncommitted diff, route, seed, camera, viewport, theme, browser and renderer. Evidence from a mixed branch such as `experimente` does not prove a different candidate.
- **Tests are minimal and focused** on public contracts ([C-53](CODING_STANDARDS.md#refactoring)); browser correctness counts more than test count.

## Verification Commands

Authoritative is `package.json`. `bun run verify` runs all gates.

| Purpose                       | Command                                                           | Role                                                                                                                     |
| ----------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Behavior tests                | `bun test <path>` or `bun run test`                               | Gate                                                                                                                     |
| Svelte and type check         | `bun run check`                                                   | Gate; checks types and Svelte only                                                                                       |
| Format and lint               | `bun run lint`                                                    | Gate; includes the "no CSS in routes" rule                                                                               |
| Build                         | `bun run build`                                                   | Gate                                                                                                                     |
| Import boundaries             | `bun run check:boundaries`                                        | Both gates: original graph with baseline and AST extension for Svelte type edges                                         |
| Svelte type edges separately  | `bun run check:boundaries:types`                                  | Additional violations against existing rules; no new baseline                                                            |
| Fallow gate                   | `bun run check:fallow`                                            | Gate; dead code, complexity, duplication against `.fallow-baselines/`; only new findings fail                            |
| Health, dead code, duplicates | `bun run analyze:health`, `analyze:unused`, `analyze:duplication` | report only, full stock; not proof of deletion                                                                           |
| Private skills untracked      | `bun run check:skills`                                            | Gate; fails if `git ls-files .agents/skills .claude/skills` prints anything                                              |
| Baseline guards               | `bun run check:baselines`                                         | Gate; dependency-cruiser and ESLint suppression baselines only shrink: growth and stale entries fail                     |
| Quality gate                  | `bun run verify`                                                  | All gates: lint, check, test, boundaries, Fallow, private skills, baselines, build. Every step runs; any failure exits 1 |
| Browser scenarios             | `bun run test:browser`                                            | Gate in CI after `verify`; Playwright Chromium, both viewports and themes ([e2e/README](../../e2e/README.md))            |
| Gate probes                   | `bun run probe:gates`                                             | Negative probes: every gate fails on an injected violation; run after changing a gate                                    |
| Reports plus gate             | `bun run review`                                                  | Fallow full-stock reports, then `verify`                                                                                 |
| Format Markdown               | `bunx prettier --write <files>`                                   | —                                                                                                                        |

Only executed checks are reported. Growth of every baseline is measured against `BASELINE_BASE`, the immutable base commit ([scripts/README](../../scripts/README.md#baseline-rules)). A tool only counts as a gate for a rule once a negative probe demonstrably fails. Which rows of the import matrix the tool covers today is documented in [ARCHITECTURE](ARCHITECTURE.md#import-matrix).

## Decision Register

### Decision Open

| #   | Question                            | Default until decision                                                                                                                                                                                                                                                                       | Owner                                                           |
| --- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 2   | Upper limit for `src/app.css`       | At most 100 physical lines. The current file exceeds it (`wc -l src/app.css`).                                                                                                                                                                                                               | [DS-41](DESIGN_STANDARDS.md#css-boundaries)                     |
| 3   | Module map of autonomous generators | Four autonomous generator families, one composition point `welt/`. No gate before the map is confirmed. Public-entry enforcement (A-30) waits for it.                                                                                                                                        | [A-41](ARCHITECTURE.md#autonomous-modules-and-composition)      |
| 4   | Budget catalog as binding target    | Proposal only; no budget is a gate. Performance claims still need measurement (PB-2).                                                                                                                                                                                                        | [PB-1](PROCEDURAL_PRINCIPLES.md#6-budgets-and-measurement-duty) |
| 5   | Axis mappings to three.js           | Both mappings stay as they are and are tested in their own declared space; none is silently flipped.                                                                                                                                                                                         | [PE-3](PROCEDURAL_PRINCIPLES.md#2-units-and-coordinate-systems) |
| 6   | Error form: exception or result     | Existing exceptions (`InvariantError`) stay; a new contract states its form explicitly.                                                                                                                                                                                                      | [PT-10](PROCEDURAL_PRINCIPLES.md#4-topology-and-embedding)      |
| 7   | Allowed dependency licenses         | The list in 100 E4 (MIT, ISC, BSL) applies. `Unlicense` (KE E7) and Apache-2.0 (`@playwright/test`, dev only, added 2026-11-17 for browser scenarios) are not on it and await a decision.                                                                                                    | [DOC-52](DOCUMENTATION_STANDARDS.md#sources-and-licenses)       |
| 8   | Authorship of adapted rules (`D*`)  | The C-64 gate (`D*`, directive of 2026-11-17) is binding. Adaptation 2026-11-17: growth is measured against the immutable base commit instead of the branch name `main`, so the check also works on `main` and in CI. Other `D*` and `N*` adaptations apply as working rules until sign-off. | [Legend](#legend)                                               |

### Noticed During Implementation, Also to Clarify

- Research notes and the standards derivation live in the private design lab ([DOC-31](DOCUMENTATION_STANDARDS.md#research)).
- The complementary AST check captures explicit Svelte type edges; remaining tool limits are listed in [ARCHITECTURE](ARCHITECTURE.md#import-matrix).
- Type checking runs in three environments: app (`tsconfig.json`, svelte-check, no Bun globals), tests and scripts (`tsconfig.bun.json`), browser scenarios (`tsconfig.e2e.json`); `bun run check` runs all three.
- Typed ESLint runs `recommendedTypeChecked` and `switch-exhaustiveness-check` on runtime code. Not enabled yet, measured 2026-11-17: `no-floating-promises` (159, mostly `node:test` calls in tests), the `no-unsafe-*` family (215), `no-unnecessary-type-assertion` (22). `noUncheckedIndexedAccess` (2,598 app diagnostics) and `exactOptionalPropertyTypes` (78) stay off; adoption is scoped per module, never as one sweep.
- ESLint suppression identities and their limits are defined in [Baseline rules](../../scripts/README.md#baseline-rules).

### Decided

David decided on 2026-11-16 that all text, comments, documentation, and website content use English. Identifiers, filenames, folders, and routes remain unchanged ([NC-01](NAMING_CONVENTIONS.md#language)).

| Decision                                                                                                                                                                             | Evidence                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| Library standards apply here 100%, translated, not copied. Read-only access to the library.                                                                                          | Brief David, 2026-11-12          |
| Review routing and separation of implementer and reviewer (above).                                                                                                                   | Brief David, 2026-11-12          |
| Bits UI for UI, three.js for 3D, CSS only in `src/app.css` and catalog components.                                                                                                   | AG                               |
| Color contract of the flows.                                                                                                                                                         | Code `data/focus.ts`, 2026-11-11 |
| `*.test.ts` belongs to `dev` regardless of folder; runtime code must not import `dev` ([A-27](ARCHITECTURE.md#import-matrix)).                                                       | Brief David, 2026-11-16          |
| Private skills are never tracked.                                                                                                                                                    | AG                               |
| Two permanent branches; `experimente` is rebased onto `main` after every merge, never rebuilt and never merged into `main` ([GW-13–GW-16](../development/git-workflow.md#branches)). | Brief David, 2026-11-17          |
| Review council, Sol loop (Sol reviews at fixed low reasoning), root-cause method, browser evidence (above).                                                                          | Brief David, 2026-11-17          |
| CI `verify` on pull requests and `main`; ruleset after the first report ([GW-60–GW-62](../development/git-workflow.md#ci-and-branch-protection)).                                    | Brief David, 2026-11-17          |

## Local Skills

Skills live locally under `.agents/skills/` and `.claude/skills/` and remain untracked. They may describe workflows and link to these standards. Normative content lives only here. Ignoring alone is not enough: the verification command above must return empty output.
