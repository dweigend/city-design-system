# City site

Composes a terrain reading and a seeded plan carrier. The default valley and alternate
samplers use world XY meters, Z up, and radians for the bearing.

- Growth takes a prefix of the same ranked carrier as size increases.
- Buildable cells have dry sampled ground and a grade limit shared with the valley survey.
- A signed water clearance clips shore cells before the carrier admits them.
- The grid retains canonical vertices with terrain heights. The datum anchors a shared
  lattice of horizontal 7 m planes.

The example reads the opening town for seed 1201 on the default valley.
