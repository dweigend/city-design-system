## Project Configuration

- **Language**: TypeScript
- **Package Manager**: bun
- **Add-ons**: none

---

- Goal: Build a design bible for a city-builder game as a SvelteKit website.
- Always build UI components with Bits UI: https://www.bits-ui.com/docs/llms
- Always build 3D components with three.js.
- Place all elements modularly in the catalog under `src/lib/catalog/`; separate UI and logic cleanly.
- Keep `src/app.css` short: global styles only. Write custom styles directly into the respective Bits UI components.
- No CSS in pages (`src/routes/**`): no `<style>` block, no inline styles. CSS exists only in `src/app.css` and in the catalog components.
- UI: sleek and minimalist.
- All texts, comments and documentation are in English.

## Standards

- Binding: Read [docs/standards/README.md](docs/standards/README.md) and the domain standards linked there before making changes. They translate the `city-library` standards to this design bible.
- Architecture: `data/` and `logic/` remain headless (no Svelte, no three.js, no DOM). `scene/` projects data with three.js. UI changes domain state only via public actions.
- Procedural: Seed, draw sequence, units (meters, radians), tolerances, and invariants follow [PROCEDURAL_PRINCIPLES.md](docs/standards/PROCEDURAL_PRINCIPLES.md). No performance or quality claim without measurement.
- New public contract phases start with 4–5 accepted, executable examples. Refactors preserve behavior, identity, ordering, and RNG continuation.
- Verification: affected `bun test` files, `bun run check`, `bun run lint`, `bun run build`. Browser-facing changes must also be tested interactively in a real browser and signed off independently using current screenshots. Only report executed checks.
- Implementer and reviewer are always different agents.
- Git delivery follows [docs/development/git-workflow.md](docs/development/git-workflow.md). Other agents' work and frozen evidence must be preserved.
- `.agents/skills/` and `.claude/skills/` must never be tracked.

## Code Review Rules

- Report only real issues: bugs, regressions, security, accessibility. No pure style nitpicks.
- Report if files under `.claude/skills/` or `.agents/skills/` are tracked.
- Report if UI components are not built with Bits UI or 3D components are not built with three.js.
- Report if UI and logic are mixed in the catalog (`src/lib/catalog/`).
- Report if `src/app.css` contains more than global styles.
- Report if pages under `src/routes/` contain their own CSS.
- Review changes to `.github/workflows/`, build configuration, or secrets especially strictly.
