# Coding Standards

These standards cover readability, public APIs, state, effects and verification. Applies to code and tests under `src/`.

## Priorities

| ID   | Rule                                                                                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C-01 | Order: correctness and accepted contracts, then clarity, simplicity, modularity, maintainability, reuse.                                                                             |
| C-02 | Minimum Sufficient Architecture: the smallest understandable solution that solves the real problem completely. Every change names benefit, affected modules, and risk.               |
| C-03 | Local fix over rebuild. Composition over inheritance. Concrete solution over speculative abstraction. Layers describe responsibility; they do not demand extra folders or wrappers.  |
| C-04 | Playability and explainability over realism. No completeness for all edge cases. Supported bounds live in the contract; within those bounds mathematical validity remains mandatory. |

## Readability

| ID   | Rule                                                                                                                                                                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C-10 | One function has one job, one file one cohesive responsibility. Around 20 lines per function and 200 per file are review signals, not limits. A visible procedural pipeline may be longer.                                     |
| C-11 | Same level of abstraction per function. Edge cases via guard clauses. Positive, simple conditions. No nested ternaries, no clever one-liners.                                                                                  |
| C-12 | No ambiguous boolean parameters. Named options or domain types. Small signatures; group related fields.                                                                                                                        |
| C-13 | Meaningful literals have names: thresholds, angles, radii, dimensions, bounds. Obvious 0 and 1 stay inline. Same number with a different meaning is its own constant. Tolerances: [PN-1](PROCEDURAL_PRINCIPLES.md#3-numerics). |
| C-14 | Dead code, unused imports, and commented-out alternatives are removed, including alternative generators. Comments explain reasons, assumptions, invariants, units, and provenance.                                             |
| C-15 | Ordinary TypeScript. Call order is visible in code. Dependencies are function arguments. No DSL, hidden scheduler or authoring wrapper.                                                                                        |

## Types and Contracts

| ID   | Rule                                                                                                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C-20 | Strict TypeScript. Untrusted data is `unknown`, not `any`. Public parameters and return values are explicitly typed; internal types may be inferred.                                             |
| C-21 | Narrow unions and discriminated states. Variants are handled exhaustively. Nullability is a deliberate decision.                                                                                 |
| C-22 | Type and non-null assertions require a documented invariant. Narrowing takes precedence.                                                                                                         |
| C-23 | Every public function documents: inputs, result, units, defaults, bounds, ordering, mutation, errors, ownership. It states whether the result is detached, a reference snapshot, or a live view. |
| C-24 | External inputs are validated at the boundary: sliders, seed, URL parameters, decoded data. No internal repetition of already-guaranteed invariants. Public error contracts remain intact.       |

## State, Effects, Dependencies

| ID   | Rule                                                                                                                                                                                                                                                      |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-30 | Every domain fact has one owner. Derive values from that owner. Keep generator state in the headless module that owns it.                                                                                                                                 |
| C-31 | Computations are pure where practical. Local mutation and stateful kernels are allowed when encapsulated. No blanket immutability mandate.                                                                                                                |
| C-32 | State mutation, I/O, logging, async ordering, and errors are explicit. No globals, no service locators, no module-wide mutable caches. Errors are not swallowed.                                                                                          |
| C-33 | Functions first. Classes only for genuine identity, encapsulated state, or lifecycle. New stateful APIs: `Name.create(options?)` with sensible defaults, nested fine options, and a function escape hatch. Existing calls are not rewritten mechanically. |
| C-34 | No grab-bag modules (`utils`, `helpers`, `manager`), no factory or interface layer without need. Abstract only what lowers concrete duplication of domain rules, complexity, or coupling. Similar code alone is not enough.                               |
| C-35 | Check existing capabilities first, then write new code or add dependencies. Optimize after measurement ([PB-2](PROCEDURAL_PRINCIPLES.md#6-budgets-and-measurement-duty)).                                                                                 |
| C-36 | Define a registry as one explicit, ordered list of entries exported as data. Keep registration out of import side effects.                                                                                                                                |

## Reference Code

The bible runs the library through its public entries.

| ID   | Rule                                                                                                                                                                                                                                                                       |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-40 | Scene compositions, demos and generators are reference code. Purpose and flow are readable from code without accompanying prose.                                                                                                                                           |
| C-41 | Parameters, setup, named rules, execution, and metrics are easy to find. The mechanism stays visible. A helper is created only when its name explains an operation.                                                                                                        |
| C-42 | Headless modules compute metrics. Components format them.                                                                                                                                                                                                                  |
| C-43 | **Example-first on the release lane.** A new public behavior begins with four to five accepted, asserted examples through the public entry. Implementation follows. Change accepted expectations only by a documented author decision. Mechanical refactors preserve them. |

## Refactoring

| ID   | Rule                                                                                                                                                                                                                              |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-50 | A refactor preserves: public calls, errors, mutation, identity (IDs), iteration and tie-breaking order, RNG draw sequence and continuation, units. Fixing behavior or changing an API is a separate, explicit task.               |
| C-51 | Sequence: read contracts, code, imports, tests, and examples; check git status; preserve other agents' work. Then decide per issue: fix, keep with justification, or report contract gap. Small, individually verifiable changes. |
| C-52 | Before extracting, verify the [architecture rules](ARCHITECTURE.md#rules), public consumers and isolation of state and RNG across instances. A cohesive longer pipeline is not a defect.                                          |
| C-53 | Tests verify public behavior, not private file splits. New regression tests only for meaningful, unprotected contracts.                                                                                                           |
| C-54 | Tools: ESLint, Prettier, TypeScript, and svelte-check remain. No second formatter (Biome is not adopted). No repo-wide reformatting inside a local refactor.                                                                      |

## Verification

| ID   | Rule                                                                                                                                         |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| C-60 | Run affected test files during work. Run the [verification commands](README.md#verification-commands) required for the lane before delivery. |
| C-61 | On the release lane, browser-facing changes require sign-off per [DS-70 and DS-71](DESIGN_STANDARDS.md#browser-and-screenshot-sign-off).     |
| C-62 | Report executed checks and state blockers and unexecuted checks.                                                                             |
| C-63 | Author review is not an independent sign-off. Roles: [README](README.md#roles-and-review).                                                   |
| C-64 | `bun run verify` runs the checks listed in [Scripts](../../scripts/README.md), including the architecture probes.                            |

## Done

A refactor is done when behavior and contracts are preserved, affected checks pass, responsibilities and dependencies are easier to understand, and concrete complexity drops — without new speculative abstractions or dependencies. Size and style metrics inform judgment; clarity takes precedence over mechanical compliance.
