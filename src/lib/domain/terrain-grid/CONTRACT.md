# Terrain grid

Builds an addressed plan from a seed, a site datum and a height sampler.

- XY coordinates, extents and elevations use meters. Bearing is in radians.
- The site accepts an explicit outline or rectangular extents with optional corner cuts.
- `site.maxOutlineDistanceM` defaults to 4,000 m. Every explicit outline point must stay
  within that distance of the datum. On rectangular sites it caps length and width.
- The same inputs and seed retain cell addresses and ordering.

Use `readPlanCellRef` to store a cell address and `readPlanCell` to open it. The grid carries its
plan identity through JSON, clipping and `TerrainGrid.select`. Bare cell keys belong to that
identity. For example, a square and a triangle can both have the key `cell/-4,-4/0`.

The plan scope includes the carrier family, seed, resolved cell size, site origin and site
bearing. Pass a distinct `scope` for each independently editable copy of a site. Changing any
of those inputs gives the plan a new identity. Expanding the outline and resampling the terrain
keep the plan identity. A cell that drops out of the crop or becomes unbuildable resolves as
`missing`. A retained address resolves to its current metric geometry.

A Voronoi corner uses the sorted IDs of the generating sites whose bisectors bound it. A short
edge collapse uses the lowest corner key in the cluster. The site outline selects complete
cells. Shoreline cuts create `shore/` keys from the canonical pair of plan corner IDs at the
crossed edge. Corner and shore positions can move while their incidence stays the same. A new
adjacency or short-edge cluster can change which corner and edge keys are present.

Run the fixed plan in [example.ts](example.ts).
