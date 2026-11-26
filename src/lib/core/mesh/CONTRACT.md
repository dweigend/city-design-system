# Swept tubes

`createSweptTube` uses an ordered, open polyline in XYZ meters. Each endpoint
tangent follows its adjacent span. Interior tangents bisect the adjacent unit
span directions. A circular section is transported by the shortest rotation
between tangents, with a stable axis chosen at the start when no transverse is
given. Supplied endpoint transverses must be unit vectors perpendicular to the
respective tangent. An end-only constraint sets a common roll for all frames.
When both endpoints constrain roll, the sweep distributes the shortest residual
roll by arc length. A half-turn consistently rolls in the positive direction.
Intermediate sections keep the applied roll increments within the configured
step limit.

The indexed shell has open ends and consistent outward winding. The first
vertex of each ring follows its transverse. End anchors face out of the run and
retain the transverse of the corresponding ring. Centerline samples stay in
input order. The result is detached from the input and contains no appearance
data. Outputs may be composed as separate object slots.

Optional FORM-5 collars form one mesh of closed annular sleeves. Each sleeve
follows the tube frame at an endpoint, a selected centerline index, or a
multiple of the optional rib spacing measured from the start. Duplicate joint
indices and coincident stations produce a single sleeve. Width is centered at
each station. The inner radius is at most the tube radius, and the outer radius
exceeds it.

Invalid options, invalid joint indices, non-finite coordinates or distances,
closed runs, zero-length or numerically collapsed spans, and tangent reversals
raise `RangeError`. The owning mesh settings bound section and facet counts.
Callers supply sufficient samples and clearance for the chosen radius and
collars. The sweep does not test self-intersection or repair tight bends.
