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

Set by David (2026-11-12):

- Implementer and reviewer are always different agents. Self-review is not a sign-off.
- Critical tasks: Fable 5.2. Independent reviews: GPT-6 Astra. Routine: GPT-6.1 Sol. Never Haiku.
- No silent substitution. If a model is unavailable, sign-off remains open.
- Findings and responses are recorded separately from sign-off.
- Reviews report only real issues (AGENTS.md, "Code Review Rules"). Size and complexity numbers are hints, not findings.

## Verification Commands

Authoritative is `package.json`. `bun run verify` runs all gates.

| Purpose                       | Command                                                           | Role                                                                                                          |
| ----------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Behavior tests                | `bun test <path>` or `bun run test`                               | Gate                                                                                                          |
| Svelte and type check         | `bun run check`                                                   | Gate; checks types and Svelte only                                                                            |
| Format and lint               | `bun run lint`                                                    | Gate; includes the "no CSS in routes" rule                                                                    |
| Build                         | `bun run build`                                                   | Gate                                                                                                          |
| Import boundaries             | `bun run check:boundaries`                                        | Both gates: original graph with baseline and AST extension for Svelte type edges                              |
| Svelte type edges separately  | `bun run check:boundaries:types`                                  | Additional violations against existing rules; no new baseline                                                 |
| Fallow gate                   | `bun run check:fallow`                                            | Gate; dead code, complexity, duplication against `.fallow-baselines/`; only new findings fail                 |
| Health, dead code, duplicates | `bun run analyze:health`, `analyze:unused`, `analyze:duplication` | report only, full stock; not proof of deletion                                                                |
| Private skills untracked      | `bun run check:skills`                                            | Gate; fails if `git ls-files .agents/skills .claude/skills` prints anything                                   |
| Quality gate                  | `bun run verify`                                                  | All gates: lint, check, test, boundaries, Fallow, private skills, build. Every step runs; any failure exits 1 |
| Reports plus gate             | `bun run review`                                                  | Fallow full-stock reports, then `verify`                                                                      |
| Format Markdown               | `bunx prettier --write <files>`                                   | —                                                                                                             |

Only executed checks are reported. A tool only counts as a gate for a rule once a negative probe demonstrably fails. Which rows of the import matrix the tool covers today is documented in [ARCHITECTURE](ARCHITECTURE.md#import-matrix).

## Decision Register

### Decision Open

| #   | Question                            | Default until decision                                                                                  | Owner                                                      |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 2   | Upper limit for `src/app.css`       | At most 100 physical lines. Current: 121 lines.                                                         | [DS-41](DESIGN_STANDARDS.md#css-boundaries)                |
| 3   | Module map of autonomous generators | Four autonomous generator families, one composition point `welt/`. No gate before the map is confirmed. | [A-41](ARCHITECTURE.md#autonomous-modules-and-composition) |

### Noticed During Implementation, Also to Clarify

- Confirm budget catalog from 100 §1 as binding target ([PB-1](PROCEDURAL_PRINCIPLES.md#6-budgets-and-measurement-duty)).
- Two different axis mappings to three.js ([PE-3](PROCEDURAL_PRINCIPLES.md#2-units-and-coordinate-systems)).
- Error form: exception or result type ([PT-10](PROCEDURAL_PRINCIPLES.md#4-topology-and-embedding)).
- License list for dependencies; `Unlicense` is missing in 100 E4 ([DOC-52](DOCUMENTATION_STANDARDS.md#sources-and-licenses)).
- Research notes and the standards derivation live in the private design lab ([DOC-31](DOCUMENTATION_STANDARDS.md#research)).
- The complementary AST check captures explicit Svelte type edges; remaining tool limits are listed in [ARCHITECTURE](ARCHITECTURE.md#import-matrix).
- The ESLint suppression baseline counts per file only and includes 5 assertions from the unfinished `logic/modellierung/`.

### Decided

David decided on 2026-11-16 that all text, comments, documentation, and website content use English. Identifiers, filenames, folders, and routes remain unchanged ([NC-01](NAMING_CONVENTIONS.md#language)).

| Decision                                                                                                                       | Evidence                         |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| Library standards apply here 100%, translated, not copied. Read-only access to the library.                                    | Brief David, 2026-11-12          |
| Review routing and separation of implementer and reviewer (above).                                                             | Brief David, 2026-11-12          |
| Bits UI for UI, three.js for 3D, CSS only in `src/app.css` and catalog components.                                             | AG                               |
| Color contract of the flows.                                                                                                   | Code `data/focus.ts`, 2026-11-11 |
| `*.test.ts` belongs to `dev` regardless of folder; runtime code must not import `dev` ([A-27](ARCHITECTURE.md#import-matrix)). | Brief David, 2026-11-16          |
| Private skills are never tracked.                                                                                              | AG                               |

## Local Skills

Skills live locally under `.agents/skills/` and `.claude/skills/` and remain untracked. They may describe workflows and link to these standards. Normative content lives only here. Ignoring alone is not enough: the verification command above must return empty output.
