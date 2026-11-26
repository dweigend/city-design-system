# Structural members

A graph is a detached, immutable set of metric XYZ joints and undirected members. Z increases
upwards. IDs are nonblank strings without Unicode control characters. Joint and member IDs are
unique within their own namespaces and serialize as JSON strings. Member endpoints are ordered
by ID. Both lists and all analysis output follow ascending string code-unit order. Parallel
members with distinct IDs are allowed. Coincident endpoints, dangling endpoints and duplicate
IDs raise a named validation error.

Pass `definitions` to `createMemberGraph` to add member roles or supply square widths, metal
areas and reference stresses. A section can supply its own reference stress. The graph-wide
reference stress and built-in definitions come from `config/structure`. Members may set
`primary` explicitly or inherit it from their section. The graph copies and freezes the values
used by geometry and analysis.

Supply nonnegative downward forces in kN, once per loaded joint. Missing entries carry zero
applied force. A reverse walk from the supports finds routes that never climb. Pinned and fixed
joints both collect vertical reactions. At a free joint, load splits among descending members
that can reach a support, by metal area. If no descending route is available, level members
with fewer hops to a support share the load by the same rule. Loads never enter dead ends.
Unreachable joints, unreacted force and the relative balance check are reported separately.

On a descending loaded member, axial demand is its routed vertical force divided by the
vertical component of its unit direction. Utilization divides demand by section area times a
nominal reference stress. Level members can transfer vertical load, with axial demand and
utilization left undefined. The result uses `null` for unavailable estimates, including on
unused members and when the demand exceeds the representable range. Subnormal shares round
in member order while conserving the applied force. This is a
vertical routing model. It omits stiffness, horizontal equilibrium, moments, buckling, joint
behavior and the distinction between pinned and fixed restraints. A routed result certifies
reachability and vertical accounting only.

## Supported frame

`createSupportedFrame` builds a straight frame between two plan points in world meters. Both
points mark bearing lines. Add intermediate lines in increasing distance from the start, with
unique keys. A span must fit the limits in `config/structure` in both directions. Each bearing
line has a pad at each edge. The terminal pads sit under the deck ends, and the crossheads and
girders carry the deck between them (CITY-7, CITY-8, FORM-6).

A roof seat is a level convex CCW polygon, an elevation, and a foundation elevation, or
`null` for stock without a verified foundation. Extra bearing outlines can narrow the
continuous stock column below the roof. The full pad plus clearance must fit each outline.
The sampler checks the center and four corners of every pad. Stock foundations must reach
those samples. Where a roof qualifies, the highest clear seat wins, with host and seat
addresses breaking ties. A terrain pier may take the load at an otherwise empty pad. Its foot
reaches the lowest of the five samples. Set `allowPiers: false` to require roof bearings at
both edges of every line (CITY-3, FORM-7, FORM-8).

Roof volumes and optional obstruction volumes reserve clearance. An obstructed frame, span
outside its limits, or station with no grounded bearing returns a named rejection before any
geometry is built. Invalid inputs throw `RangeError`. The result is detached and frozen. Each
bearing records its soffit point, seat, sampled center ground, and foundation. The graph
ends at pinned roof or pier seats. Bearings on stock record the continuation from the roof
to its foundation. The object emits deck, frame, joint, and any pier parts. Each bay has an
upward-facing socket on the deck inside the post collars. Addresses derive from the frame
and stations, so they survive a dimension change that preserves those stations (FORM-5, MAT-1).
