# City volume

Assigns district types and levels to an immutable plan, then builds the carrier lattice.

- Growth starts at one source per connected set of eligible dry regions. It expands through shared edges and enters adjacent regions at crossing heads.
- Districts follow cumulative accessible area and bound nominal neighbor height steps.
- Ground joints sit at the terrain corners. Above ground, every joint on an upright
  lies on a shared 7 m plane. Clamped corners may give a triangular side face. Body-centered hubs clamp to the sampled elevation at their own horizontal position.
- The roof has the assigned number of levels above the plane at or above the
  highest corner. Columns share all overlapping side faces and their joints.
- Every model emits closed, outward-wound solids owned by canonical bays. Foundation
  caps support the level recipes. Where a frustum meets a full bay, the side is split
  so both solids reuse the same face and joints.
- The taper field gives every plan corner, cell centre and edge midpoint a horizontal retreat
  per level above its lowest neighbour; signed use retreats or overhangs. Lattices stay upright.
- Coordinates are in world meters, with Z up. Keyed draws replay for a fixed seed.

The example builds the box lattice for the fixed stepped city plan.
