# Design Standards

Owner for: UI stack and precedence, tokens, technical color and material contract, CSS boundaries, component API, accessibility, browser and screenshot sign-off. The visual design statements themselves (vision, color rules, forms) belong to the Bible; their texts live in `src/lib/catalog/data/`.

## UI Stack and Precedence

| ID    | Rule                                                                                                                                                                                | Source · Auth.               |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| DS-01 | **Minimal.** Every visible element serves a reader task; everything else is omitted. Accessible names, necessary labels, actionable errors, and source attributions remain visible. | UI §Minimal UI; AG · D       |
| DS-02 | **Bits UI.** Interactive UI components are built with Svelte 5 and Bits UI. No second component library. The library rule "shadcn and Tailwind first" does not apply here.          | AG · D                       |
| DS-03 | **three.js.** 3D is built only with three.js and only in `scene/` ([A-25](ARCHITECTURE.md#import-matrix)).                                                                          | AG · D                       |
| DS-04 | **KISS and YAGNI.** Only used components. No speculative settings, abstractions, or catalog entries, no empty scaffolding.                                                          | UI §KISS, §YAGNI · N         |
| DS-05 | Every catalog component has one responsibility and a small, typed contract. Consumers do not reach into private files, DOM structure, renderer internals, or styles.                | UI §Encapsulated modules · N |

## Tokens

| ID    | Rule                                                                                                                                                                                                                   | Source · Auth.                   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| DS-10 | **One fixed visual system.** Colors, fonts, sizes, spacing, lines, and control dimensions live once as tokens in `src/app.css`. Components use tokens only. No one-off colors, no local themes, no per-page overrides. | UI §One fixed visual system · N  |
| DS-11 | Light and dark belong to the same system: the same tokens, paper and ink swapped.                                                                                                                                      | UI; Code `src/app.css` · N       |
| DS-12 | **One unit.** 1 U = 4 px = 1 m, steps 1 · 5 · 10 · 50 · 100. The same unit carries layout, isometric drawing, and the 3D world.                                                                                        | Code `src/app.css`; README · N   |
| DS-13 | No hex value outside `src/app.css`.                                                                                                                                                                                    | Code `data/color.ts` (Bible) · N |

Status of search on 2026-11-12: no six-digit hex values in catalog components. No lint gate.

## Color and Material

| ID    | Rule                                                                                                                                                                                                   | Source · Auth.                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| DS-20 | **Flow color contract.** `flowToken` in `data/focus.ts` is the single source: flow → token. Decided by the author on 2026-11-11. Changes only by him; `data/color.test.ts` locks down the contract.    | Code `data/focus.ts` · D                                          |
| DS-21 | The Bible's color rules (one palette, color is meaning, depth is material, proportion rule) belong to `data/color.ts` and the `/farben` page. They are not repeated here.                              | Code `data/color.ts` · N                                          |
| DS-22 | UI chrome and semantic colors are separated. An accent is never a flow color.                                                                                                                          | UI §One fixed visual system; Code `logic/parametrik/types.ts` · N |
| DS-23 | **Second channel.** Every color-coded meaning additionally carries pattern, form, or text.                                                                                                             | Code `data/focus.ts` (`pattern`) · N                              |
| DS-30 | **Material contract.** Materials are typed, headless descriptors: key, value ranges, color space, meaning of alpha and finish. No renderer objects (`THREE.Color`, `Material`) in `data/` or `logic/`. | Transfer addendum; A-21, A-23 · V                                 |
| DS-31 | There is exactly one named place that translates tokens and descriptors into renderer values. It lives in `scene/`.                                                                                    | Transfer addendum · V                                             |
| DS-32 | The same material key yields defined parameters regardless of the scene. A color or material change does not regenerate structure ([PP-4](PROCEDURAL_PRINCIPLES.md#5-projection)).                     | Transfer addendum; 99 No. 5 · V                                   |
| DS-33 | Every 3D model provides all levels of representation. The system chooses the level, not the model.                                                                                                     | Code `data/focus.ts` (`levels`) · N                               |

Unchecked: color-space chain from sRGB tokens to the renderer, value ranges of all materials, uniqueness of the translation point.

## CSS Boundaries

| ID    | Rule                                                                                                                                                                                                                                                | Source · Auth.                     |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| DS-40 | `src/app.css` contains globals only: tokens, base element defaults, necessary imports.                                                                                                                                                              | AG · D                             |
| DS-41 | **Decision open.** Default: `src/app.css` has at most 100 physical lines, including comments and blank lines. The current file exceeds it; measure with `wc -l src/app.css`. The limit is not bypassed by minifying or adding a second global file. | UI §Small global stylesheet · open |
| DS-42 | **No CSS in routes** (`src/routes/**`): no `<style>` block, no `style` attribute, no `style:` directive.                                                                                                                                            | AG · D                             |
| DS-43 | Component CSS lives in the `<style>` block of the catalog component. This replaces the library rule "external stylesheets, no Svelte CSS."                                                                                                          | AG · D                             |
| DS-44 | Inline styles in components only for computed values: custom properties and dimensions from data. Static styling lives in the `<style>` block.                                                                                                      | UI §Encapsulated styling · N\*     |
| DS-45 | Consumers do not style internals of foreign components. Variants work through props. `:global` only where Bits UI requires it for its own parts.                                                                                                    | UI §Encapsulated styling · N\*     |

Status of search on 2026-11-12: no CSS in routes. An ESLint rule is configured for DS-42; it is enforced by `bun run lint`. In components, 132 occurrences of `:global`; not individually evaluated.

## Component API

| ID    | Rule                                                                                                                                                       | Source · Auth.                                 |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| DS-50 | **Default first.** Omitting gives defined, usable behavior.                                                                                                | UI §Binding UI authoring rules · N             |
| DS-51 | **Flat first.** Pages and demos are flat compositions. No builder chains, no configuration layers, no deeply nested layout trees.                          | UI §Binding UI authoring rules · N             |
| DS-52 | **One normal syntax.** Short props and typed actions. No custom UI DSL, no competing shorthands.                                                           | UI §Binding UI authoring rules; Transfer · N\* |
| DS-53 | Customization sits on the affected entry. Short projections inline; longer functions named and placed below the description.                               | UI §Binding UI authoring rules · N             |
| DS-54 | Components are thin and mutate domain state only through actions ([A-03, A-04](ARCHITECTURE.md#layers)). Shared infrastructure owns rendering and cleanup. | UI §Simple public authoring API · N            |

## Accessibility

| ID    | Rule                                                                                                          | Source · Auth.                  |
| ----- | ------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| DS-60 | Every control has an accessible name and is keyboard-reachable. The global focus ring remains visible.        | UI §Minimal UI; AG (Review) · N |
| DS-61 | Text contrast is checked in both themes, including text on colored surfaces (`--on-cat`, `--on-accent`).      | 99 No. 6; Transfer addendum · V |
| DS-62 | Color-vision deficiency is checked. The second channel (DS-23) carries the meaning on its own.                | Transfer addendum · V           |
| DS-63 | 3D views have a text alternative or caption. Their controls sit outside the canvas and are keyboard-operable. | Transfer addendum · V           |
| DS-64 | Motion respects `prefers-reduced-motion`.                                                                     | Proposal of this file · V       |

The global stylesheet sets transition and animation durations to zero when `prefers-reduced-motion: reduce` matches.

## Browser and Screenshot Sign-off

| ID    | Rule                                                                                                                                                                                                                                                                            | Source · Auth.                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| DS-70 | Every UI-facing change is operated and photographed in a real browser: desktop at least 1366 × 768, narrow 390 × 844, light and dark, every affected state.                                                                                                                     | UI §Browser and independent screenshot gate · N     |
| DS-71 | An independent agent inspects the actual screenshots and checks them against these standards. Self-review does not suffice ([Roles](README.md#roles-and-review)). Paths, tested flows, findings, and responses are recorded separately from sign-off.                           | UI §Browser and independent screenshot gate; LA · N |
| DS-72 | Findings are fixed; browser testing and screenshot review then run again. A blocker in browser or reviewer leaves sign-off open. Reading source code does not replace it.                                                                                                       | UI §Browser and independent screenshot gate · N     |
| DS-73 | A picture of the WebGPU scene is evidence of the look only when it was taken on the hardware GPU (`bun run shot`). A software-rendered image of that scene is rejected, and it is never performance evidence ([PB-5](PROCEDURAL_PRINCIPLES.md#6-budgets-and-measurement-duty)). | KE E3; Brief David, 2026-11-20 · D                  |

Comparison plates and holding variables constant: [DOC-43](DOCUMENTATION_STANDARDS.md#experiments-tables-plates).
