# City volume

Assigns district identity, density and levels to an immutable plan, then builds the carrier lattice.

- Growth starts at one source per connected set of eligible dry regions. It expands through
  shared edges and enters adjacent regions at crossing heads.
- A district is a connected set of occupied plan cells. The lowest-ranked founding plan
  address gives it the ID `district/<cell>`. A merger keeps the earliest founder's ID.
  Density follows cumulative accessible area and may change within a district. A
  `densityRegionId` identifies one connected patch of a single density for display.
- Ground joints sit at the terrain corners. Above ground, every joint on an upright lies
  on a shared level plane. Body-centered hubs use the triangulated bay caps and sampled
  ground at their own horizontal position. If those bounds leave no room, the bay has no hub.
- A joint clamped to terrain carries `groundContact: true`. The flag does not enter its address.
- A column roof has the assigned number of levels above the plane at or above the highest
  corner. Structural columns can come from the district profile or from a supplied level and kind
  assignment. The lattice accepts a plane spacing and level cap, with defaults of 7 m and 15 levels.
  Validation rejects duplicate cell IDs, duplicate corners within a ring and conflicting positions
  for a shared corner ID. The lattice also checks each occupied span before allocating geometry.
- Canonical bay addresses follow the plan and level. A bay carries its parent plan cell ID,
  lower level, counterclockwise plan corners, floor, ceiling and sides in plan edge order.
  Stacked bays share the cap at their common level. Neighbors share the side named by their
  plan edge and lower level. Face loops resolve in `bayCorners`, including collapsed contacts.
- Each model emits its own `nodes`, `edges` and outward-wound solids. A clamped internal
  diagonal can divide one bay into multiple solids. Where a frustum meets a full bay, both
  solids reuse the same face and joints.
- `subdivideBay` assigns a plan kite to every corner and divides each kite vertically.
  For a quad this gives eight child bays. A child face or edge is a sorted tuple of logical
  point IDs, so either incident bay can derive it from the same plan and level addresses.
  Logical points have no interpolated positions.
- Coordinates are in world meters, with Z up. Keyed draws replay for a fixed seed.

The example builds a braced hex lattice and resolves the floor and child addresses of its first bay.
