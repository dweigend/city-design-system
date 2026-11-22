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

## Stylesheet

[The Interface chapter](../../src/routes/interface/+page.svelte) shows the styles defined in [`src/app.css`](../../src/app.css).

| ID    | Rule                                                                                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DS-10 | Styles are shared across pages and controls. Compose element defaults and classes from `src/app.css`.                                                   |
| DS-11 | The same palette names apply in both themes. `[data-theme='dark']` sets the dark variant.                                                               |
| DS-12 | Layout spacing uses multiples of 0.25 rem (4 px at the default text size). The stylesheet defines one radius, one stroke width and one motion duration. |

### Typography

Geist is the sans family. Geist Mono is used for code, labels and values. Sizes below are at the default browser font size.

| Element or class | Size     | Use                                                |
| ---------------- | -------- | -------------------------------------------------- |
| `h1`             | 40–64 px | Page title, scales with the viewport               |
| `h2`             | 24 px    | Section heading                                    |
| `h3`             | 20 px    | Subsection heading                                 |
| `p`              | 16 px    | Body paragraph                                     |
| `.lead`          | 20 px    | Intro paragraph                                    |
| `.small`         | 13 px    | Secondary text                                     |
| `.caption`       | 13 px    | Picture caption, also the default for `figcaption` |
| `.label`         | 11 px    | Uppercase UI and axis labels                       |
| `.data`          | 13 px    | Monospaced numbers and values                      |

Links, lists, figures, images, rules, inline code and tables have shared element defaults.

### Layout

| Class      | Use                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------- |
| `.page`    | Center a reading column up to 46 rem wide with 16 px side gutters at the default text size. |
| `.stack`   | Space items vertically.                                                                     |
| `.cluster` | Place items in a row and wrap as needed.                                                    |
| `.grid`    | Fit columns to the space available.                                                         |
| `.frame`   | Hold a picture or canvas in a 16:9 area.                                                    |
| `.panel`   | Give content a paper surface with padding and a thin border.                                |
| `.divider` | Draw a thin horizontal rule, also the default for `hr`.                                     |

### Palette

The palette contains paper, ink and line, categories and flows, ground and terrain, blueprint, signal and hazard, and analysis tones. The Interface chapter displays these colors with a `.swatch` class and a modifier for each token. Literal color values, including hex, OKLCH and RGB, belong only in `src/app.css`.

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
| DS-45 | Configure a component’s visual variants through its props. Use shared stylesheet classes for the visual variants.                 |
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
