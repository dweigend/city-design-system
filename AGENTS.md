# City Design System

Design bible and 3D sandbox for a city-builder game, built from one shared library. SvelteKit, TypeScript, Bun, three.js (WebGPU + TSL), Bits UI. Repository text, identifiers, files and folders use English.

## Two lanes

- **`rebuild` is the build lane.** Work in packages. Fast-forward pushes are standing-authorized.
- **`main` is the release lane.** Changes require David's word, a pull request, `bun run verify` and the merge council.
- **`experimente` is a frozen, read-only quarry.** Port selected code into a package. Keep quarry branches out of merges.

See [Lanes](docs/standards/README.md#lanes) and [Git Workflow](docs/development/git-workflow.md).

## Before you build

1. Read the principles for your area in `src/routes/design-principles.ts` and the bible page you touch.
2. Look at the reference image named in the brief. If a visual package lacks a reference, ask before building.
3. Read the [rebuild brief](docs/development/rebuild.md) and the standard that owns your change. Use the [reading table](docs/standards/README.md#what-to-read).

## A package

- One goal, one builder, one result. About 90 minutes, at most two corrections.
- Follow the [rebuild package order](docs/development/rebuild.md#packages). Run the checks and put the hardware-GPU shot beside its reference for David's approval when the package delivers a picture.
- Cite design principles by ID. Update the register with any changed design rule and name the IDs in the result. Otherwise report “principles unchanged.”

## When you do not know

- Do not guess and do not research at length in your own context. By default, send a subagent on GPT Sol 6.2 at low reasoning with one precise question.
- Ask for a short answer: the finding, its source, and what stayed unverified. Only that answer enters your context.

## Library

- [Architecture](docs/standards/ARCHITECTURE.md) owns the ten rules. `src/lib/` contains `core`, `domain`, `world`, `scene` and `ui`. Each module is one flat folder with a documented `index.ts`, private siblings, a contract test and a fixed-input example.
- Core, domain and world run headlessly. Geometry names slots. Scene assigns color and material and projects data with three.js. Only the stage creates renderers, cameras and frame loops.
- Page text and page-local widgets live in `src/routes`. Put CSS in `src/app.css`. Use controls from `src/lib/ui`, the home of Bits UI and Lucide imports.
- Use short, focused functions. Follow the [coding standards](docs/standards/CODING_STANDARDS.md), [naming conventions](docs/standards/NAMING_CONVENTIONS.md) and [glossary](docs/standards/GLOSSARY.md).
- Follow the [procedural principles](docs/standards/PROCEDURAL_PRINCIPLES.md) for the seed, draw sequence, units, tolerances and invariants. Measure performance and quality claims.
- Reproduce the defect, explain its cause and fix it there.

## Release lane only

- `bun run verify` must pass. Browser-facing changes and dependency updates also require browser tests and independent sign-off on current screenshots.
- Implementer and reviewers are different agents. The [merge council](docs/standards/README.md#roles-and-review) reports before the merge.
- Refactors preserve behavior, identity, ordering and RNG continuation. A new public behavior starts with four to five accepted, executable examples.
- Report executed checks. Run a single test file with `bun test <path>`.

## Never

- Track `.agents/skills/` or `.claude/skills/`, commit secrets, third-party reference images or lab material, or link to the private lab.
- Add AI attribution to commits or pull requests.
- Touch `main`, force-push or delete another agent's work without David's word.
- Run tests, builds or browsers on the shared build server outside `heavy-slot`.

## Code review for main

- Report real bugs, regressions, security and accessibility issues.
- Report tracked private skills, violations of the architecture and design rules stated outside the register.
- Review workflows, build configuration and secrets especially strictly.
