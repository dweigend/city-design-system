# Architecture

As of 2026-11-12. Draft; legend, source abbreviations, and status are in [README](README.md).

Owner for: layers, import matrix, public contracts, autonomous modules and composition, ownership of state and resources, known current deviations. This file describes the **target state**. The current state deviates; those deviations are listed [below](#current-deviations).

## Principles

| ID   | Rule                                                                                                                                                                                                                                                                          | Source · Auth.                                  |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| A-01 | Ten principles apply: one responsibility per module; high cohesion, low coupling; directed dependency; encapsulation; explicit contracts; composition over inheritance; single source of truth; dependency inversion; functional core with imperative shell; local evolution. | AR §Ten architectural principles · N            |
| A-02 | **Headless invariant.** Every domain capability is callable through a public TypeScript API without UI and executable in Bun. Replacing the UI requires no change to `data/` or `logic/`.                                                                                     | PR 1, 7; AR §Strict separation · D              |
| A-03 | UI may import logic, logic never UI. Components do not compute domain rules.                                                                                                                                                                                                  | AR §Strict separation; AG · D                   |
| A-04 | UI changes domain state only via public actions or functions, never by assigning to domain objects. Renderers receive detached data records and report intent: ID and action.                                                                                                 | AR §Strict separation, §Layers · N              |
| A-05 | Domain logic uses no framework types: no runes, stores, lifecycle hooks. I/O, persistence, network, and browser access live in explicit adapters outside `data/` and `logic/`.                                                                                                | AR §Strict separation, §Layers · N              |
| A-06 | Import is inert: no registration, no DOM access, no timer, no mutable global state when loading a module. Pure constants and fixtures are allowed.                                                                                                                            | AR §Shared UI; ST · D\*                         |
| A-07 | SvelteKit is the host, the catalog is the repository store. The host discovers and renders; the core computes. Folders and exports are created only with a working slice. No empty target folders.                                                                            | ST §Principles; AR §Binding domain layout · D\* |

## Layers

Translation of the three library layers (core, optional controller, UI) onto the catalog.

| Layer       | Location                                        | Responsibility                                                                       |
| ----------- | ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| `data`      | `src/lib/catalog/data/**/*.ts`                  | Declarative facts: tokens, tables, chapter copy, color contract, fixtures. No rules. |
| `logic`     | `src/lib/catalog/logic/**/*.ts`                 | Rules, generators, state owners, metrics, headless scene composition.                |
| `scene`     | `src/lib/catalog/scene/**/*.ts`                 | Projection of data to three.js. Owns GPU resources.                                  |
| `component` | `src/lib/catalog/**/*.svelte`, `**/*.svelte.ts` | View with Bits UI. Thin: accept input, call function, show result.                   |
| `route`     | `src/routes/**`                                 | Mount one page component. One-liner. No CSS.                                         |
| `dev`       | `**/*.test.ts`, `**/benchmark.ts`               | Verify and measure. No runtime code imports them.                                    |

Test files (`*.test.ts`) belong exclusively to the `dev` layer regardless of folder; this assignment takes precedence over folder rules.

Mapping of library concepts:

| Library                                      | Here                                                                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| autonomous core modules `library-core/<mod>` | generator families under `logic/parametrik/` (see [Module map](#autonomous-modules-and-composition)) |
| `world-composition/`                         | one named composition point; default `logic/parametrik/welt/`                                        |
| `models/<slug>/model.ts`                     | headless scenes and demos in `logic/bibel/`, `logic/ansicht/`; assertable                            |
| `models/<slug>/ui.ts`                        | catalog components of a bible page or lab demo: flat, with defaults                                  |
| `ui-web/`                                    | `ui/`, `foundations/` (Bits UI building blocks)                                                      |
| `ui-3d/`                                     | `scene/`                                                                                             |
| Model Lab (host)                             | SvelteKit routes and page components in `design/`                                                    |
| `tests/public-contracts/`                    | `*.test.ts` alongside the module, only via public entry points                                       |

## Import Matrix

✔ allowed, ✘ forbidden. Prohibitions also apply to `import type` and transitive imports.

The `core` layer owns the public entry points `core/params/index.ts` and
`core/random/index.ts`. Catalog consumers can import these entry points directly.
The existing logic entry points forward to them. The `core-no-higher-layers`
rule allows headless core files and explicitly approved npm packages as import
targets. The package list is empty. Each core module's runtime code depends
only on its own files. External consumers and contract tests access a core
module through its `index.ts`. Tests remain in the `dev` layer and can also
import `bun:test`. Tests named `*.unit.test.ts` can import private files in
their own module.

| from ↓ · to → | `data` | `logic` | `scene` | `component` | `route` | `svelte`, `$app` | `bits-ui`, `lucide-svelte` | `three` |
| ------------- | :----: | :-----: | :-----: | :---------: | :-----: | :--------------: | :------------------------: | :-----: |
| `data`        |   ✔    |    ✘    |    ✘    |      ✘      |    ✘    |        ✘         |             ✘              |    ✘    |
| `logic`       |   ✔    |    ✔    |    ✘    |      ✘      |    ✘    |        ✘         |             ✘              |    ✘    |
| `scene`       |   ✔    |    ✔    |    ✔    |      ✘      |    ✘    |        ✘         |             ✘              |    ✔    |
| `component`   |   ✔    |    ✔    |    ✔    |      ✔      |    ✘    |        ✔         |             ✔              |    ✘    |
| `route`       |   ✘    |    ✘    |    ✘    |      ✔      |    ✔    |        ✔         |             ✘              |    ✘    |
| `dev`         |   ✔    |    ✔    |    ✔    |      ✘      |    ✘    |        ✘         |             ✘              |    ✔    |

As rules for dependency-cruiser. The "Tool" column names the rule in `.dependency-cruiser.cjs` (as of 2026-11-12); "—" means: not yet configured, rule name is a proposal.

**Current tool coverage (2026-11-14).** The Svelte adapter of dependency-cruiser analyzes compiled JavaScript; pure type edges are still missing there. `check:boundaries:types` therefore augments the complete dependency-cruiser graph via Svelte and TypeScript AST with explicit type imports and type re-exports from instance and module scripts (`import type`, inline `type`, `export type`, inline type re-exports). Relative paths, TS path aliases, and package imports are resolved; unresolvable type edges fail the check. The augmented graph checks the existing rules `headless-core`, `data-no-logic`, and `no-cycles` for additional violations, including cycles across TS and multiple Svelte type edges. Findings already present in the original graph stay with the existing gate and its unchanged baseline. `check:boundaries` runs both gates even if one fails; `review` incorporates this combined gate. Executable positive and negative fixtures: `scripts/svelte-type-boundaries.test.ts`. The extension does not implement any of the matrix rules marked "—" below; type expressions like `import('./modul').Typ` are not part of this extension.

| ID   | from               | forbidden to                                          | Tool                                          | Source · Auth.                                             |
| ---- | ------------------ | ----------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------- |
| A-20 | `data`             | `logic`, `scene`, `component`, `route`                | `data-no-logic`, `headless-core`; `route` —   | Transfer Matrix (three layers) · N\*                       |
| A-21 | `data`             | `svelte`, `$app`, `bits-ui`, `lucide-svelte`, `three` | `headless-core` for `svelte`, `three`; rest — | PR 1; AR §Strict separation · D                            |
| A-22 | `logic`            | `scene`, `component`, `route`                         | `headless-core`; `route` —                    | AR §Ten architectural principles (Dependency rule); AG · D |
| A-23 | `logic`            | `svelte`, `$app`, `bits-ui`, `lucide-svelte`, `three` | `headless-core` for `svelte`, `three`; rest — | PR 1; AR §Strict separation · D                            |
| A-24 | `scene`            | `component`, `route`, `svelte`, `$app`, `bits-ui`     | — (`scene-no-ui`)                             | AR §Layers · N\*                                           |
| A-25 | `component`        | `three`                                               | — (`component-no-three`)                      | AR §Layers (renderers in visualization layer) · N\*        |
| A-26 | `route`            | `data`, `logic`, `scene`, `bits-ui`, `three`          | — (`route-thin`)                              | AG; UI §Flat first · D\*                                   |
| A-27 | all except `dev`   | `dev`                                                 | `no-runtime-to-dev`                           | ST §Import rules · D                                       |
| A-28 | `src/lib/catalog/` | cycles                                                | `no-cycles` plus Svelte type-edge extension   | AR §Dependency rules · N                                   |

Not verifiable via the import graph and must be evidenced separately:

- Browser globals (`document`, `window`, `localStorage`) in `data/` and `logic/`: forbidden (A-05). Verify via lint or Bun run without DOM.
- No CSS in routes: [DS-42](DESIGN_STANDARDS.md#css-boundaries).
- Routes as one-liners: A `+page.svelte` imports exactly one page component and renders it. `+layout.svelte` loads `app.css`.

## Public Contracts

| ID   | Rule                                                                                                                                                                                     | Source · Auth.             |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| A-30 | Consumers outside a module import only its public entry points. The entry point is `index.ts`; additional entry points are listed in the module map. No deep imports into private files. | AR §Dependency rules · N\* |
| A-31 | Public contracts are small. Private helpers remain private; headless does not mean exporting every function.                                                                             | AR; SK decisions · N       |
| A-32 | Types live with their domain owner. No grab-bag folders `types/`, `utils/`, `core/`. The render contract `Primitive` belongs to `logic/parametrik/types.ts`.                             | AR §Kernels · N            |
| A-33 | Kernel, algorithms, and explicit variants are separated. Variants are swappable through small, task-scoped contracts. No plugin registry, no universal manager, no deep inheritance.     | AR §Kernels · N            |
| A-34 | Reusable mathematics carries neutral names. Urbanism rules carry domain names. This transfer creates no dependency on `city-library`.                                                    | PR 2, 3; Transfer · D\*    |

## Autonomous Modules and Composition

| ID   | Rule                                                                                                                                                                                                          | Source · Auth.                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| A-40 | Generator families declared autonomous do not import each other, not even for types. Coordinate types are declared structurally. Not every subdirectory of `logic/` is autonomous.                            | ST §Principles · D\*               |
| A-41 | The accepted module map puts numeric parameter schemas and both random contracts in `core`. The generator map below describes the legacy layout during migration.                                             | Brief David, 2026-11-18 · D        |
| A-42 | Shared flows across autonomous families live in exactly one named composition point. It may import all families; no family imports it.                                                                        | ST §Principles · D\*               |
| A-43 | Only small, stable helpers may be copied between autonomous families. Each copy is registered and passes shared conformance cases. Identity, geometric predicates, and copy semantics have exactly one owner. | ST §Duplication rule · D           |
| A-44 | Scenes and demos (`logic/bibel/`, `logic/ansicht/`) are consumers. They import only public entry points; nothing imports them except components and tests.                                                    | ST §Import rules (`models/`) · D\* |

Legacy generator module map:

| Role                   | Module under `logic/parametrik/`                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| autonomous             | `raster/` (grid generators), `raster/universal/kern/` (carrier, transactions), `formen/` (form families), `eckraster/` (corner modules, occupancy) |
| shared contract base   | `types.ts` (render contract), `random.ts` (randomness)                                                                                             |
| single composition pt. | `welt/`                                                                                                                                            |
| open                   | `komposition/`, `raster/universal/` without `kern/`, `logic/modellierung/`                                                                         |

Measured coupling on 2026-11-12 (import paths, excluding tests): `formen` and `eckraster` import each other; `kern` and `raster/universal` import each other; `raster/universal` imports `eckraster`. Today, no family is autonomous.

## State, Resources, Ownership

| ID   | Rule                                                                                                                                              | Source · Auth.                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| A-50 | One identity and lifecycle protocol. No competing registries. IDs, transactions, undo, and cache invalidation have named owners.                  | ST §Consequences; AR §Kernels · D     |
| A-51 | Every live value has exactly one authority (table below). Other places hold references or detached observations, never a second mutable copy.     | AR §State, hosts and verification · N |
| A-52 | `scene/` owns all GPU resources. Every creation has a `dispose` path. Components hold the canvas and lifecycle and call it.                       | AR §Layers · N                        |
| A-53 | Canvas layout, camera, dragging, and selection highlight are view state. They are never authority for topology, randomness, or world coordinates. | AR §Layers · N                        |

| State                                   | Owner (current)                           | Note                                  |
| --------------------------------------- | ----------------------------------------- | ------------------------------------- |
| Corner-grid occupancy, undo/redo        | `logic/parametrik/eckraster/state.ts`     | explicit actions (103)                |
| Core model, transactions                | `logic/parametrik/raster/universal/kern/` | ownership contract not yet documented |
| World structure and its cache           | `logic/parametrik/welt/index.ts`          | module-wide cache: deviation          |
| Flow color contract                     | `data/focus.ts`                           | set by David                          |
| Theme (light, dark)                     | `data/theme.svelte.ts`                    | UI state in wrong place: deviation    |
| Camera, selection, canvas, GPU resource | `scene/` and components                   | view state                            |

## Current Deviations

Measured on 2026-11-12 via import search in `src/lib/catalog/`, excluding `logic/modellierung/` (in progress). The parallel tooling run lists the same cases as baseline: 11 `data` → `logic` imports, 3 renderer imports, 1 cycle. This list is a starting baseline, not an assignment; fix sequence: see the step plan in the private design lab.

| Rule        | Location                                                                                        | Kind                               |
| ----------- | ----------------------------------------------------------------------------------------------- | ---------------------------------- |
| A-20        | `data/color.ts`, `data/werkbank.ts`, `data/stadt.ts`, `data/material.ts` (type only) → `logic/` | Data imports logic                 |
| A-21, A-05  | `data/city3d.ts` → `three`, `window`                                                            | three.js scene in data folder      |
| A-21, A-05  | `data/theme.svelte.ts` → Runes, `document`, `localStorage`                                      | UI state in data folder            |
| A-23        | `logic/parametrik/raster/geometry.ts` → `three` (`ShapeUtils`, `Vector2`)                       | Renderer math in logic             |
| A-25        | `labor/L10View.svelte` → `three`                                                                | Component uses three.js directly   |
| A-28        | `raster/universal/update.ts` ↔ `raster/universal/index.ts`                                      | Import cycle (103 step 2)          |
| A-30        | Components import individual files, e.g., `logic/parametrik/welt/ansicht`                       | Entry points not established       |
| A-40        | see measured coupling above                                                                     | no autonomous family               |
| C-32, PT-14 | module-wide caches in `logic/parametrik/welt/index.ts`                                          | shared cache lifetime (103 step 3) |

Not measured: transitive imports, deep imports in detail, `dispose` paths. Cycle search is incomplete: type imports from `.svelte` files are missing from the graph.

**Addendum 2026-11-14 on A-25.** A read-only search for module specifiers `three` and `three/…` across all `*.svelte` and `*.svelte.ts` files under `src/lib/catalog/` yields zero hits. The direct component import from the historical table is therefore no longer present in the current codebase. This is not a check of transitive imports or full architectural sign-off; the measurement of 2026-11-12 remains readable unchanged.

## Verification

Check per implementation slice: headless access via public entry points, import direction, explicit contracts, one owner per state; for UI additionally: only defined actions, no domain rule in the component (AR §Layers · N). The tool covers A-20 through A-23 and A-28 only partially; A-24 through A-27 are unchecked. A-28 is extended with explicit Svelte type edges; coverage and remaining limits are in [Import Matrix](#import-matrix). New violations are findings. The baseline is reduced separately and never broadened wholesale.
