# Universal Grid

**Every grid ends in quads, so every form fits every plot.** The same seed and the same sliders produce the same city logic on nine grid systems. Only the geometry changes.

## Nine grids, strict to free

Square, axis, triangle, hexagon, polar, contour, Voronoi, irregular quad, organic. The organic grid combines a density field with a flow field: curved alleys, tight center.

## Three independent layers

| Layer     | Owns                                             | Derived from it                         |
| --------- | ------------------------------------------------ | --------------------------------------- |
| Semantics | Occupancy, protection, program stack per region  | Game state, independent of mesh density |
| Topology  | Source faces with shared vertex IDs              | Half-edges, dual, derivation tree       |
| Geometry  | Positions in meters, quality limits, cross-field | Checked quads, streamlines, rendering   |

## Rules

- **Identity.** IDs come from input and rule path, never from coordinates.
- **Polygon to quad.** A convex n-gon gets a center and shared edge midpoints: n quads. A concave ring is triangulated first; each triangle yields three quads. The boundary stays fixed.
- **Quality is checked, not smoothed.** Defaults: minimum angle 1°, scaled Jacobian ≥ 0.01, area ≥ 1e-10 m², aspect ratio ≤ 1000. These are geometric limits, not walkable dimensions. A failed repair throws `quality-unattainable`; limits are never lowered.
- **Fields.** Directions average as `exp(4iθ)`. Streamlines use the midpoint method with step `h = step/√ρ`, so density tightens the mesh.
- **Parcels.** A block is cut at 1/2, 2/5 or 3/5 of its extent. Both children keep frontage on an alley or elevated walkway; otherwise the cut is rejected as `landlocked`.
- **Changes.** A transaction runs proposal → dependency closure → check → publication. Untouched subtrees are reused by reference. Undo and redo return exact snapshots.
- **Ports.** Three channels: walking, supply, structure. Paths that cross in plan are not connected. Levels connect only through a stair, lift or ramp.

## Measurement

Import of a patch with strict validation and one subdivision. Bun 1.4.2, seed 42, median of five runs.

| Grid           | Quads | Median ms | Min. angle ° | Max. aspect ratio |
| -------------- | ----: | --------: | -----------: | ----------------: |
| square         |   400 |     41.04 |        90.00 |              1.00 |
| hex            |   456 |     41.42 |        60.00 |              1.73 |
| polar          |   528 |     35.15 |        30.00 |              2.42 |
| voronoi        |   512 |     25.97 |        22.79 |             14.40 |
| quad-irregular |  3840 |    208.11 |        54.41 |              1.76 |
| field-guided   |   256 |     34.26 |        89.84 |              1.05 |

A local change to 4 of 64 subtrees takes 1.18 ms; the full build takes 11.19 ms (median). The contour grid passes only with declared, more permissive limits.

## Limits

- No global cross-field solver and no automatic singularity placement.
- Parcels need convex blocks; alley width is not reserved as area.
- Results are deterministic on one JavaScript runtime. Cross-platform bit identity is not guaranteed.

Principles behind these rules: [02-geometry-principles.md](02-geometry-principles.md).
