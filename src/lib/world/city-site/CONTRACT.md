# City site

Composes a terrain reading and a seeded plan carrier. The default valley and alternate
samplers use world XY meters, Z up, and radians for the bearing.

- Growth takes a prefix of the same ranked carrier as size increases.
- A nominal 60 m cell must be dry and span at most 16 m of sampled elevation.
- A buildable region needs 0.36 km² of connected dry cells. Up to eight regions can
  open, and each starts with at least 10,800 m² of built cells.
- A signed water clearance clips shore cells before the carrier admits them.
- The grid retains canonical vertices with terrain heights. The datum anchors a shared
  lattice of horizontal 7 m planes.

The example reads the opening town for seed 1201 on the default valley.
