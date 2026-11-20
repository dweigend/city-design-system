# City Design System

Design bible and 3D sandbox for a city-builder game, built from one shared library. SvelteKit, TypeScript, bun, three.js (WebGPU + TSL), Bits UI. All texts, comments and docs are English.

## Two lanes

- **`experimente`, the build lane.** Early stage: move fast, the picture decides, things may break. Work in packages. Fast-forward merges and pushes to `experimente` are standing-authorized (GW-03).
- **`main`, the release lane.** Changes only on David's word, through a pull request, `bun run verify` and the merge council. `experimente` is never merged into `main`.

Which rule gates which lane: [Lanes](docs/standards/README.md#lanes). Git: [git-workflow](docs/development/git-workflow.md).

## Before you build

1. Read the design principles of your area in `src/lib/catalog/data/design-principles.ts` and the bible page you touch. Extend what exists; do not reinvent it.
2. Look at the reference image named in the brief. No reference: ask before building.
3. Read only the standard that owns your change; the [reading table](docs/standards/README.md#what-to-read) routes you. Read the `CONTRACT.md` of a module you touch where one exists.

## A package

- One visual goal, one builder, one result. About 90 minutes, at most two follow-ups.
- Done means: `bun run ship <branch>` passed (fast gate, merge, push, shot), the picture stands beside its reference, and the register is updated if a principle changed.
- Pictures are judged from hardware-GPU shots only (`bun run shot`).
- A design rule is written down in the design-principles register and nowhere else. A brief cites principles by id; the result says "principles unchanged" or names the changed id.
- No review, audit, cleanup or status agents on this lane.

## Library

- Everything lives modularly in `src/lib/catalog/`. `data/` and `logic/` are headless: no Svelte, three.js or DOM. `scene/` projects data with three.js. UI changes domain state only through public actions.
- Bible and sandbox use the same library and engine. No bible-only or game-only code path.
- Every object follows the one object contract: role slots, footprint and anchors in meters, no colors in geometry. The engine palette colors.
- Import other modules through their public entry point only; keep helpers private; one owner per domain fact ([ARCHITECTURE](docs/standards/ARCHITECTURE.md)). New module names are English.
- Short functions: one job per function, one responsibility per file ([CODING_STANDARDS](docs/standards/CODING_STANDARDS.md)). Names follow [NAMING_CONVENTIONS](docs/standards/NAMING_CONVENTIONS.md) and [GLOSSARY](docs/standards/GLOSSARY.md). Document every public function (C-23).
- UI components: Bits UI (https://www.bits-ui.com/docs/llms). 3D: three.js. UI is sleek and minimalist.
- CSS only in `src/app.css` (globals only, short) and in catalog components. None in `src/routes/**`: no `<style>`, no inline styles.
- Seed, draw sequence, units (meters, radians), tolerances and invariants follow [PROCEDURAL_PRINCIPLES](docs/standards/PROCEDURAL_PRINCIPLES.md). No performance or quality claim without measurement.
- Root cause first: reproduce, explain, fix the cause. No stacked workarounds.

## Release lane only

- `bun run verify` exits 0: lint, check, test, test:perf, boundaries, Fallow, private skills, baselines, build. `bun run test:browser` for browser-facing changes and dependency updates, then an independent agent signs off on current screenshots.
- Implementer and reviewer are different agents; the merge council reports before the merge ([Roles and Review](docs/standards/README.md#roles-and-review)).
- Refactors preserve behavior, identity, ordering and RNG continuation. A new public contract phase starts with 4–5 accepted, executable examples.
- Report only executed checks. Single test file: `bun test <path>`.

## Never

- Extend a baseline (`.fallow-baselines/`, `.dependency-cruiser-baseline.json`, `eslint-suppressions.json`) or run `check:fallow:baseline` to pass. Fix the code.
- Track `.agents/skills/` or `.claude/skills/`; commit secrets, third-party reference images or lab material; link to the private lab.
- Add AI attribution to commits or pull requests.
- Touch `main`, force-push, or delete another agent's work without David's word.
- Run tests, builds or browsers on the shared build server outside `heavy-slot`.

## Code Review Rules

These rules apply to reviews of pull requests into `main`.

- Report only real issues: bugs, regressions, security, accessibility. No pure style nitpicks.
- Report tracked files under `.claude/skills/` or `.agents/skills/`.
- Report UI not built with Bits UI, 3D not built with three.js, and UI mixed with logic in `src/lib/catalog/`.
- Report non-global styles in `src/app.css` and any CSS in `src/routes/`.
- Report color values in object geometry and design rules stated outside the design-principles register.
- Report extended baselines without a documented owner decision.
- Review changes to `.github/workflows/`, build configuration or secrets especially strictly.
