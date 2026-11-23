# City volume

Assigns district types and levels to an immutable plan, then builds the carrier lattice.

- Districts follow cumulative accessible area and bound nominal neighbor height steps.
- Ground joints sit at the terrain corners. Above ground, every joint on an upright
  lies on a shared 7 m plane. Clamped corners may give a triangular side face.
- The roof has the assigned number of levels above the plane at or above the
  highest corner. Columns share all overlapping side faces and their joints.
- Coordinates are in world meters, with Z up. Keyed draws replay for a fixed seed.

The example builds the box lattice for the fixed stepped city plan.
