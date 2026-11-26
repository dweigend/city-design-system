# Envelope

Facade bands and membrane patches use surveyed attachment addresses and XYZ points in meters
(GRID-7). The operators use no random draws. They emit only the `envelope-band`, `membrane`
and `envelope-clip` role slots (MAT-1). Metric defaults and sampling limits live in the
envelope config. Results are detached, deeply frozen `PlaceableObject` values with measured
XY footprints. The caller supplies the object ID. Part IDs are slot names. No input is changed.

## Facade bands

`createFacadeBands` reads an open, ordered XY frontage with at least two grips. The grip Z
sets the center of the first course. Successive grips may change direction and elevation.
Consecutive bays join along a shared mitered cross-section with no internal caps at a fixed
pitch. Courses are open between the band profiles, including at the clips. Each grip gets a
larger cuff sized from its adjoining bay spans, joined seamlessly across interior grips
(FORM-5). Each bay end carries an anchor facing to the right of that bay, ordered by bay,
course, then end. Their names encode the two bay grip IDs, zero-based course and attachment ID.

Duplicate addresses, invalid positions, collapsed spans, retraced or intersecting XY bays,
tight turns that fold the profile, course counts outside the integer range [1, 128],
and dimensions that collapse at the supplied coordinates raise `RangeError`. The frontage
intersection check is quadratic in bay count. Mesh and anchor generation is linear in bays
times courses.

## Tension patch

`createTensionPatch` reads four cyclic, potentially noncoplanar grips. Their projection
onto the plane perpendicular to the diagonal cross product must be strictly convex. The
current winding defines the outward side. The patch uses a bilinear plate, plus smooth
quadratic offsets from the surveyed edge midpoints and center sag. An optional grip on
each edge must project to that edge's midpoint. The corresponding boundary curve passes
through the surveyed point. The sag is the shortest corner span times the sag ratio,
divided by one plus the tension ratio, directed inward. This is a geometric envelope
model. The ratios do not calculate fabric stress.

The mesh has a square grid of evenly spaced parameter samples, two outward triangles
per tile and no repeated boundary vertices. Cuffs at the corners and optional edge
grips follow the adjoining seams (FORM-5). Anchors are ordered corners first, then
present edge grips in ring order. Their normals use the shared outward direction.

The operator raises `RangeError` on invalid addresses or coordinates, nonconvex or
degenerate projected geometry, sag outside [0, 0.5], tension outside (0, 1], or subdivisions
outside the integer range [2, 128]. With surveyed edge midpoints the subdivision count
must be even. Generation and the winding check are quadratic in subdivision count.

The fixed example spans three facade bays including a return and a saddle canopy held
by four corners and two edge grips.
