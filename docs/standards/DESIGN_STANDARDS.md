# Design Standards

The [design principles register](../../src/routes/design-principles.ts) owns the city’s visual design rules. [Architecture](ARCHITECTURE.md#rules) owns stylesheet placement and library boundaries.

## UI Stack and Precedence

| ID    | Rule                                                                                                                                                                                |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DS-01 | **Minimal.** Every visible element serves a reader task; everything else is omitted. Accessible names, necessary labels, actionable errors, and source attributions remain visible. |
| DS-02 | **Bits UI.** Build interactive controls with Svelte and Bits UI in the UI kit. Use one component library.                                                                           |
| DS-03 | **three.js.** Build 3D with three.js in scene.                                                                                                                                      |
| DS-04 | **KISS and YAGNI.** Add only used components. No speculative settings, abstractions, entries or scaffolding.                                                                        |
| DS-05 | Every shared component has one responsibility and a small, typed API. Consumers use that API to configure it.                                                                       |

## Tokens

| ID    | Rule                                                                                                                                                                                                                   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DS-10 | **One fixed visual system.** Colors, fonts, sizes, spacing, lines, and control dimensions live once as tokens in `src/app.css`. Components use tokens only. No one-off colors, no local themes, no per-page overrides. |
| DS-11 | Light and dark belong to the same system: the same tokens, paper and ink swapped.                                                                                                                                      |
| DS-12 | **One unit.** 1 U = 4 px = 1 m, steps 1 · 5 · 10 · 50 · 100. The same unit carries layout, isometric drawing, and the 3D world.                                                                                        |

## Color and Material

| ID    | Rule                                                                                                                                                                               |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DS-20 | One mapping assigns the semantic color for each flow. Test that mapping. Changes require David’s approval.                                                                         |
| DS-22 | UI chrome and semantic colors are separated. An accent is never a flow color.                                                                                                      |
| DS-23 | **Second channel.** Every color-coded meaning additionally carries pattern, form, or text.                                                                                         |
| DS-30 | **Material descriptors.** Define a key, value ranges, color space and the meaning of alpha and finish. Keep renderer objects in scene.                                             |
| DS-31 | One boundary in scene translates tokens and material descriptors into renderer values.                                                                                             |
| DS-32 | The same material key yields defined parameters regardless of the scene. A color or material change does not regenerate structure ([PP-4](PROCEDURAL_PRINCIPLES.md#5-projection)). |
| DS-33 | Every 3D model provides all levels of representation. The system chooses the level, not the model.                                                                                 |

## Component API

| ID    | Rule                                                                                                                              |
| ----- | --------------------------------------------------------------------------------------------------------------------------------- |
| DS-45 | Configure a component’s visual variants through its props. Leave its internal styles with the component owner.                    |
| DS-50 | **Default first.** Omitting gives defined, usable behavior.                                                                       |
| DS-51 | **Flat first.** Pages and demos are flat compositions. No builder chains, no configuration layers, no deeply nested layout trees. |
| DS-52 | **One normal syntax.** Short props and typed actions. No custom UI DSL, no competing shorthands.                                  |
| DS-53 | Customization sits on the affected entry. Short projections inline; longer functions named and placed below the description.      |
| DS-54 | Components are thin and mutate domain state only through actions. Shared infrastructure owns rendering and cleanup.               |

## Accessibility

| ID    | Rule                                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------- |
| DS-60 | Every control has an accessible name and is keyboard-reachable. The global focus ring remains visible.        |
| DS-61 | Check text contrast in both themes, including text on colored surfaces.                                       |
| DS-62 | Color-vision deficiency is checked. The second channel (DS-23) carries the meaning on its own.                |
| DS-63 | 3D views have a text alternative or caption. Their controls sit outside the canvas and are keyboard-operable. |
| DS-64 | Motion respects `prefers-reduced-motion`.                                                                     |

## Browser and Screenshot Sign-off

| ID    | Rule                                                                                                                                                                                                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DS-70 | Every UI-facing change is operated and photographed in a real browser: desktop at least 1366 × 768, narrow 390 × 844, light and dark, every affected state.                                                                                                                     |
| DS-71 | An independent agent inspects the actual screenshots and checks them against these standards. Self-review does not suffice ([Roles](README.md#roles-and-review)). Paths, tested flows, findings, and responses are recorded separately from sign-off.                           |
| DS-72 | Findings are fixed; browser testing and screenshot review then run again. A blocker in browser or reviewer leaves sign-off open. Reading source code does not replace it.                                                                                                       |
| DS-73 | A picture of the WebGPU scene is evidence of the look only when it was taken on the hardware GPU (`bun run shot`). A software-rendered image of that scene is rejected, and it is never performance evidence ([PB-5](PROCEDURAL_PRINCIPLES.md#6-budgets-and-measurement-duty)). |

Comparison plates and holding variables constant: [DOC-43](DOCUMENTATION_STANDARDS.md#experiments-tables-plates).
