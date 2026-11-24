# Material contract

Procedural surface families as data. A family is a recipe that lays units, joints and trim on a
planar patch and raises them as real relief geometry. It knows nothing of houses, cities or pages
and carries no colour: it emits role slots (`unit`, `unit-alt`, `trim`, `joint`, `shade`), and
`scene/surface` colours them at one boundary (`paintClad`).

- A patch is an origin, a unit `across` axis and a unit outward `normal` (up = normal × across),
  a size and backing thickness in meters, an optional convex outline (a gable), rectangular
  openings and convex shadows cast by other bodies.
- Families: render (scored panels), masonry (running bond), timber (boards and battens), metal
  (trapezoid corrugation with lap seams), glass (mullion grid and panes), paving (setts, laid flat).
  Module, joint, relief and shares come from `src/config/material`.
- Levels: `relief` raises units and casts hard shade along `light`; `flat` is one slab in the unit
  tone; `pencil` is that slab with one line per joint. `readSurfaceLevel` maps the focus display
  levels onto them.
- Budget: a relief patch coarsens its module until it fits `patch.budget` (else the configured
  density times its area) and falls back to `flat` after the step limit.
- The same family, patch and options always yield the same arrays.

See `/surfaces` for the sample plates and the sample body.
