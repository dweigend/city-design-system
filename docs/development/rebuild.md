# Rebuild

The library is rebuilt from an empty tree on the branch `rebuild`. A module returns only when a bible page needs it for a picture. Every other branch and the private lab are quarries: code is ported from them piece by piece, never merged.

## Target

```text
src/app.css            the only stylesheet
src/routes/<chapter>/  page text, image links and page-local widgets
src/lib/ui/            the UI kit, the only place that imports Bits UI
src/lib/scene/         one stage and the projections, the only place that imports three.js
src/lib/world/         composition of domain modules
src/lib/domain/        one flat folder per capability
src/lib/core/          geometry, random, params, object contract
```

| Rule | Statement                                                                                                 | Check              |
| ---- | --------------------------------------------------------------------------------------------------------- | ------------------ |
| 1    | Imports point downward only: routes → ui, scene → world → domain → core.                                  | dependency-cruiser |
| 2    | The module graph has no cycles.                                                                           | dependency-cruiser |
| 3    | Another module is imported through its `index.ts` only. No `export *`.                                    | dependency-cruiser |
| 4    | `core`, `domain` and `world` run in Bun without DOM, Svelte or three.js.                                  | dependency-cruiser |
| 5    | A domain module imports at most three other domain modules. More is composition and belongs to `world`.   | dependency-cruiser |
| 6    | Geometry names slots. Color and material are assigned at one boundary in `scene`.                         | ESLint             |
| 7    | No `<style>` block and no inline style. All CSS lives in `src/app.css`.                                   | ESLint             |
| 8    | Controls come from `src/lib/ui`. No raw `button`, `input` or `select`, no Bits UI import outside the kit. | ESLint             |
| 9    | Page content lives in `src/routes`. The library holds no chapter text.                                    | dependency-cruiser |
| 10   | Only the stage creates a renderer, a camera or a frame loop.                                              | ESLint             |

A module is one folder: `index.ts` with documented exports, private sibling files, `contract.test.ts` against the entry, and `example.ts` with fixed inputs. The blocks page of chapter 8 is generated from these three. Function names follow the verb table of the sister library (`create`, `add`, `delete`, `take`, `read`, `set`, `select`, `sample`, `advance`, `run`; computed results are nouns).

## Working rules

- One package, one builder, one worktree branched from `rebuild`, about 90 minutes.
- Packages R00–R07 run one at a time. After R07 at most two run in parallel.
- A package is done when the checks pass, the hardware-GPU shot stands beside its reference and the owner has approved the picture. Opus 5.5 writes the leading picture verdict, Sol 6.2 and Argon add a second opinion. Two corrections at most, then the package is rebuilt.
- A special case is removed, not carried over. A feature that needs one is left out.
- Ported code is cut to the module shape above. Compatibility entries, forwarding files, `legacy` names and baselines do not enter the branch.
- A rule enters the standards together with its check and a failing probe.
- A chapter page shows only real demos. A chapter without a demo has its heading and nothing else.

## Packages

### Foundation

| ID  | Package          | Done when                                                                                                                          | Quarry                                              |
| --- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| R00 | Empty tree       | `src/lib` and `src/routes` hold one page; baselines and superseded check scripts are gone; build, `ship` and `shot` work.          | `scripts/ship.ts`, `scripts/shot.ts`                |
| R01 | Rules and checks | `ARCHITECTURE.md` is one page with the ten rules; each rule has a check and a failing probe; `AGENTS.md` and naming match.         | `.dependency-cruiser.cjs`, `scripts/probe-gates.ts` |
| R02 | Stylesheet       | `app.css` defines one `h1`, `h2`, `h3`, five text formats, the color tokens and the layout primitives; rule 7 is enforced.         | `src/app.css`, lab `mvp-zuarbeit/referenzen`        |
| R03 | UI kit           | At most ten components on Bits UI; chapter 7 shows each one once; rule 8 is enforced.                                              | `src/lib/catalog/ui`, `interface/`                  |
| R04 | Book frame       | One layout with menu and chapter header; ten chapter folders with headings; the landscape page carries its text in `+page.svelte`. | `chapter-frame/`, lab `bibel-v3/00-konzept.md`      |

### Core and stage

| ID  | Package         | Done when                                                                                                                                                                                                                                                                       | Quarry                                                              |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| R05 | Core            | `geometry`, `random`, `params` and `invariant` exist with contract tests; one continuing seeded stream type with keyed child streams, as in the sister library; shared inputs `height` and `width` (1–32 m, measured on the bounding box of the result) and `complexity` (0–1). | `core/*`, `logic/parametrik/types.ts`, `data/block-inputs`          |
| R06 | Object contract | One primitive type with slot names, footprint and anchors in meters; one function assigns palette and material; a test rejects a color in geometry.                                                                                                                             | `logic/assets/index.ts`, `scene/scene-palette.ts`                   |
| R07 | Stage           | One stage mounts on a page and shows the same geometry in iso and plan, with normal and transparency display. Further views arrive with the content that needs them. Switching uploads no geometry.                                                                             | `scene/sandbox/stage.ts`, `scene/chapter-stage`, `logic/view-modes` |

### Slices

Each slice adds one module and the page step that shows it.

| ID   | Package               | Chapter | Done when                                                                                                                                                                                                                                                                       | Quarry                                                                              |
| ---- | --------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| R08  | Valley                | 1       | The seeded river valley appears on the landscape page; sinuosity varies with the seed and is a public parameter; the frozen measurement protocol passes.                                                                                                                        | `logic/valley`, `logic/river-metrics`, `scene/valley`                               |
| R09  | City plan             | 2       | A coarse organic cell plan follows the terrain in step 1.                                                                                                                                                                                                                       | `logic/terrain-grid`, `logic/quad-grid`                                             |
| R10  | City volume           | 2       | The plan grows by accessibility (CITY-13). Districts and a lattice per connected part show the area-driven skyline (CITY-12). Zoom resolves from a true-scale quarter to the city envelope. `scripts/city-study.ts` checks each part, enclosed gaps, shape and monotone growth. | `logic/city-volume`, `logic/parametrik/welt/netze`                                  |
| R10a | Parcels and fine grid | 2       | Districts are divided into plots; inside a plot the lattice is subdivided; only then volumes arise.                                                                                                                                                                             | `logic/cell-space`, `logic/occupancy`                                               |
| R11  | House and court       | 5       | One house with a court stands on a parcel of the cell space, driven by `height`, `width`, `complexity`.                                                                                                                                                                         | `logic/house-court`, `logic/parcel-deck`                                            |
| R12  | Three style houses    | 5       | Memphis, Archigram and organic houses are distinct at first glance beside their references and share the cell space as their underlying system.                                                                                                                                 | branch `t3/three-distinct-style-houses`, lab `pakete/038-formregeln.md`             |
| R13  | Movement network      | 3       | Elevated walkways connect houses; a route query returns the shortest path with a fixed tie order.                                                                                                                                                                               | `logic/movement-network`, branch `t3/rebuild-movement-path-search`, `logic/walkway` |
| R14  | Transit line          | 3       | An elevated rail line runs through the valley and docks to the movement network.                                                                                                                                                                                                | `logic/transit-line`                                                                |
| R15  | Structural members    | 5       | A member graph carries a megastructure frame; loads read from the same graph.                                                                                                                                                                                                   | `logic/traeger`, `logic/statik`, `logic/megastructure`                              |
| R16  | Asset registry        | 8       | Placeable objects build through one entry; the blocks page lists every module from its example.                                                                                                                                                                                 | `logic/assets`, branch `t3/asset-registry-contract-checks`                          |
| R17  | Surfaces and palette  | 6       | Material sample plates show real relief like the reference pictures; the palette colors by material through the one assignment boundary in both display modes.                                                                                                                  | `logic/material`, `logic/farbe`, `theme/`                                           |
| R18  | Sandbox world         | —       | The sandbox paints houses on the grid with strokes, undo and redo, using only modules from R08–R17.                                                                                                                                                                             | `logic/sandbox`, `sandbox/`                                                         |
| R19  | Supply                | 4       | Shown as a picture only, the balance is computed by the sister library; defined after its acceptance picture exists.                                                                                                                                                            | lab `bibel-v3/04-*`                                                                 |
| R20  | Content and story     | 9       | Defined after its acceptance picture exists.                                                                                                                                                                                                                                    | lab `bibel-v3/09-*`                                                                 |

### Closing

| ID  | Package                | Done when                                                                                 |
| --- | ---------------------- | ----------------------------------------------------------------------------------------- |
| R21 | Sister-library seam    | Stable serializable IDs and the shared geometry types are agreed with the sister library. |
| R22 | Replace the build lane | `rebuild` replaces `experimente` on the owner's word.                                     |
