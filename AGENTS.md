# City Design System

Design bible for a city-builder game as a SvelteKit website. TypeScript, bun. All texts, comments and docs are English.

## Rules

- Read [docs/standards/README.md](docs/standards/README.md) and the standards it links before changing code. They are binding; each rule has one owner file.
- UI components: Bits UI (https://www.bits-ui.com/docs/llms). 3D: three.js. UI is sleek and minimalist.
- Everything lives modularly in `src/lib/catalog/`. `data/` and `logic/` are headless: no Svelte, three.js or DOM. `scene/` projects data with three.js. UI changes domain state only through public actions.
- Independent modules: import other modules through their public entry point only; keep helpers private; one owner per domain fact ([ARCHITECTURE](docs/standards/ARCHITECTURE.md)).
- Short functions: one job per function, one responsibility per file; about 20 and 200 lines trigger review ([CODING_STANDARDS](docs/standards/CODING_STANDARDS.md)).
- One vocabulary: names follow [NAMING_CONVENTIONS](docs/standards/NAMING_CONVENTIONS.md) and [GLOSSARY](docs/standards/GLOSSARY.md). Document every public function (C-23).
- CSS only in `src/app.css` (globals only, short) and in catalog components. None in `src/routes/**`: no `<style>`, no inline styles.
- Procedural code: seed, draw sequence, units (meters, radians), tolerances and invariants follow [PROCEDURAL_PRINCIPLES](docs/standards/PROCEDURAL_PRINCIPLES.md). No performance or quality claim without measurement.
- Research, ideas and side experiments happen in the private lab repository (sibling folder); `main` only gets accepted results. Code experiments that need the catalog stay on branch `experimente`, which is never merged into `main` ([GW-13–GW-16](docs/development/git-workflow.md#branches)).
- A new public contract phase starts with 4–5 accepted, executable examples. Refactors preserve behavior, identity, ordering and RNG continuation.
- Root cause first; review roles, merge council and browser evidence: [Roles and Review](docs/standards/README.md#roles-and-review).

## Verification

- Run `bun run verify` before reporting any code change as done. It must exit 0: lint, check, test, test:perf, boundaries, Fallow, private skills, baselines, build.
- Fallow and boundary gates block new findings. Never extend a baseline (`.fallow-baselines/`, `.dependency-cruiser-baseline.json`, `eslint-suppressions.json`) to pass; fix the code.
- Single test file: `bun test <path>`.
- Browser-facing changes and dependency updates: `bun run test:browser`, then operate them in a real browser; an independent agent signs off on current screenshots.
- Report only executed checks. Implementer and reviewer are always different agents.

## Delivery

- Git follows [docs/development/git-workflow.md](docs/development/git-workflow.md). Do not commit or push without authorization. Preserve other agents' work and frozen evidence.
- `.agents/skills/` and `.claude/skills/` must never be tracked.
- Local skills: `refactor-catalog` (headless logic), `refactor-scene` (demos, scenes), `git-delivery`, `model-routing`, `frontend-design`.

## Code Review Rules

- Report only real issues: bugs, regressions, security, accessibility. No pure style nitpicks.
- Report tracked files under `.claude/skills/` or `.agents/skills/`.
- Report UI not built with Bits UI, 3D not built with three.js, and UI mixed with logic in `src/lib/catalog/`.
- Report non-global styles in `src/app.css` and any CSS in `src/routes/`.
- Report extended baselines without a documented owner decision.
- Review changes to `.github/workflows/`, build configuration or secrets especially strictly.
