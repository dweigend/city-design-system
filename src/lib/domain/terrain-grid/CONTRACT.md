# Terrain grid

Builds an addressed plan from a seed, a site datum and a height sampler.

- XY coordinates, extents and elevations use meters. Bearing is in radians.
- The site accepts an explicit outline or rectangular extents with optional corner cuts.
- `site.maxOutlineDistanceM` defaults to 4,000 m. Every explicit outline point must stay
  within that distance of the datum. On rectangular sites it caps length and width.
- The same inputs and seed retain cell addresses and ordering.

Run the fixed plan in [example.ts](example.ts).
