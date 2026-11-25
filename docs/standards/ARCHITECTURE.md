# Architecture

## Structure

```text
src/app.css              All styles
src/routes/<chapter>/    Page text, image links and page-local widgets
src/lib/ui/<module>/     Shared controls
src/lib/scene/<module>/  Stage, projections and material assignment
src/lib/world/<module>/  Composition of domain modules
src/lib/domain/<module>/ One capability per folder
src/lib/core/<module>/   Geometry, random, parameters and object primitives
```

## Rules

| #   | Rule                                                                                                                                                                                                                | Check                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Routes may import any layer. UI stays within UI. Scene may import world, domain and core. World may import domain and core. Domain may import core. Core stays within core, with `bun:test` available in its tests. | dependency-cruiser `downward-only-ui`, `downward-only-scene`, `downward-only-world`, `downward-only-domain`, `downward-only-core`, `downward-only-core-test` |
| 2   | File and module-folder dependencies are acyclic.                                                                                                                                                                    | dependency-cruiser `no-file-cycles`, `no-module-cycles`                                                                                                      |
| 3   | Import other modules through their `index.ts`. Export names explicitly and keep module folders flat.                                                                                                                | dependency-cruiser `module-entry-only`, `module-entry-from-outside`, ESLint `no-restricted-syntax`                                                           |
| 4   | Core, domain and world run in Bun. Keep browser globals, Svelte, SvelteKit app imports, Bits UI, Lucide and three.js out of those layers.                                                                           | dependency-cruiser `headless-imports`, ESLint `no-restricted-globals`                                                                                        |
| 5   | A domain module imports at most three distinct peer modules across all its files. Wider composition belongs in world.                                                                                               | `domain-max-three`, from dependency-cruiser JSON                                                                                                             |
| 6   | Geometry names slots. Assign color and material at one boundary in scene. Keep hex color strings, `rgb(` and `hsl(` values and CSS custom-property strings out of headless layers.                                  | ESLint `no-restricted-syntax`                                                                                                                                |
| 7   | Put CSS in `src/app.css`. Import only that stylesheet. Use classes in Svelte and omit style blocks, inline style attributes and style directives.                                                                   | dependency-cruiser `app-css-only`, ESLint `no-restricted-syntax`                                                                                             |
| 8   | Use controls from the kit. Raw `button`, `input`, `select` and `textarea` elements and imports from Bits UI or Lucide belong in UI.                                                                                 | ESLint `no-restricted-syntax`                                                                                                                                |
| 9   | Page text and page-local widgets live in routes. Library modules cannot import routes. Only scene imports three.js.                                                                                                 | dependency-cruiser `routes-own-pages`, `three-only-in-scene`                                                                                                 |
| 10  | Only `src/lib/scene/stage/` constructs a renderer or camera, calls `setAnimationLoop` or requests an animation frame.                                                                                               | ESLint `no-restricted-syntax`                                                                                                                                |
| 11  | The owning capability slice in `src/config/` supplies numeric tunables. Document the unit, meaning, and rationale or design principle of each setting. Derive shared values at the point of use.                    | dependency-cruiser `config-owner-only`, ESLint `config/no-tunable-number`, `bun run check:config`                                                            |

## Module shape

Use one flat folder directly under its layer. Keep every file at that level.

- `index.ts` is the only public entry. Document every exported name with a JSDoc summary at the declaration or re-export. Run `bun run modules:catalogue` to read those summaries.
- Private implementation files sit beside the entry.
- `contract.test.ts` verifies behavior through the entry.
- `example.ts` runs the entry with fixed inputs.

Modules under `src/lib/ui` are presentational and are demonstrated on the `/interface` page instead of carrying `contract.test.ts` and `example.ts`.
Modules under `src/lib/scene/stage-view` are presentational and are demonstrated on the `/sandbox` page instead of carrying `contract.test.ts` and `example.ts`.

## Object contract

A placeable object has an id, ordered slot names, parts, a local width and depth, and named anchors with positions and unit normals.
Parts have unique ids and each names a declared slot. Geometry is a box rotated about Z, an extrusion of an implicitly closed ground polygon, or an indexed triangle mesh.
Coordinates and footprint dimensions are in meters, with XY on the ground and Z up. Rotations are in radians.
The scene's surface module assigns color tokens and finishes to slots.

## Check a change

1. Does each file belong to the layer that owns its work?
2. Do imports use public entries, point downward and leave both graphs acyclic?
3. Do headless modules run in Bun, use geometry slots and stay within the domain peer limit?
4. Do routes own page content, UI own controls, scene own three.js and the stage own rendering and scheduling?
5. Does the flat module have a documented entry, a contract test and a fixed-input example, and does `bun run verify` pass?
