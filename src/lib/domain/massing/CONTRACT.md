# Massing

`createHouseOccupancy` fills a cell space using metric block inputs, a uint32 seed and resolved
occupancy parameters. It keeps cell order and returns half-open storey runs, ordered entrance
paths and a reason when the plot cannot be built. Site callbacks sample the selected frontage
midpoint in plan meters and assign phase and use by datum index and cell ID. Only occupied
storeys take program rows. The eaves, cell jitter and open ground draws retain their independent
seed keys. The fixed example places an office above a raised entrance in one frontage cell.

`cellOverrides` can set the occupied storey count of an existing built column by fine-cell ID.
The run keeps its original floor. Counts above the house cap clamp to the cap. Zero clears the
column and preserves an open passage if the column was a gate. Negative, fractional, and
unknown cell overrides raise `RangeError`. The final occupancy checks the entrance and shared
court access before the house derives surfaces or part addresses.

## Upper-storey operators

`createMassing` opens a house occupancy for editing. Its `base` keeps the input ground plan,
cell identities, and entrance paths. Its `runs` contain only occupied half-open `HouseCell`
ranges, ordered by the base's cell order and then by storey. A hole splits a range into two
runs with the same cell ID. Programs keep their original datum keys and are filtered to each
run. Operators accept this representation in either order and leave their input untouched.

- `createSetbackMassing` starts at an explicit zero-based upper storey (at least one). Each
  step takes `depth` shared-side hops inward, from the frontage by default or from the full
  parcel perimeter. At a cell `h` hops from the edge, the exclusive height cap is
  `startStorey + floor(h / depth) × stepStoreys`. The interval defaults to one storey.
  Internal strip seams are outside the edge seed set. Unreachable cells have no setback cap. The cut also drops any overhang at or above the
  start that lost support. A zero depth or a cut above the space returns the input.
- `createPorousMassing` targets the rounded ratio of occupied slices strictly above their
  original column feet. It preserves the ground plan, raised entrances and the ground
  route to the court. It ranks candidates by one `Random` draw keyed by the storey address
  and breaks ties by that address. The seed defaults to the house seed. It can carve the
  top slice as a terrace or open a slice below retained volume when at least two sides
  are open at that level. Unmatched internal seams do not count as open sides. It revisits blocked candidates after successful cuts and stops at
  the target or when no cut remains. Each void records its original address and its kind
  at the time of carving. A zero ratio returns the input and an empty void list.

An occupied slice is supported by a continuous stack reaching its original column foot, or
by one side neighbour with such a stack at the same level. A suspended run cannot in turn
support another suspended run. The original raised and gate feet are treated as supported
by their existing construction. This is a cell adjacency rule, shared by irregular and
orthogonal parcels (GRID-5).

`createMassingParts` emits one closed prism per retained slice in cell and storey order.
The footprint is the original counterclockwise cell ring, the vertical bounds are the
original storey elevations and its ID is `<cell ID>/envelope/datum/<datum index>`, as in
the addressed neutral envelope. The only part slot is `mass` (MAT-1). The fixed operator
example cuts a frontage and carves upper voids on the resulting court house.
