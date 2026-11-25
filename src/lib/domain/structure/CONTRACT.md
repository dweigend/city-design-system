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
