# Face docking

Sockets read the outward-wound faces of the solids measured by `latticeVolumes`. They use the
actual lattice joints, including diagonals and shifted planes (GRID-5, GRID-7). A face with more
than one incident solid is internal. Socket IDs encode the sorted joint IDs of exposed faces.
The socket list follows first incidence, and each polygon starts at its least joint ID without
changing the winding. Direct face input keeps the supplied order. The first longest edge sets
the tangent direction, and the bitangent completes the right-handed frame. The center is the
face's area centroid. Width and height measure its extents along the two in-plane axes.

A socket requires a convex, planar face. The lattice reader skips warped and non-convex faces,
nonpositive solids and faces whose planes do not support the owning solid. This keeps the
entire owner behind the contact plane, even on a slanted cell. Direct socket input with an
invalid ring throws `RangeError`. The caller supplies outward winding. Coordinates use world
meters and unit directions, with a metric roundoff allowance for contact tests.

A module uses local X and Y across the mount and local Z out from the carrier. It must have at
least one area-bearing mounting triangle at Z = 0, no vertices below it and some geometry strictly
above it. The mounting vertices must lie inside the socket polygon. The body may overhang in
the outward half-space. Boxes, convex prisms and indexed meshes are supported. Pre-triangulate
concave parts as meshes. Local part IDs, slots and anchor names retain their order. Rigid placement
translates positions and rotates normals. The output ID combines the socket and source IDs.
The output keeps the source's local footprint. Its separate world AABB includes the collar.

Each accepted object carries an outward-extruded inset of the socket polygon in the reserved
`dock-collar` part and slot. The collar starts on the same contact plane and leaves positive
module depth beyond it (FORM-5). The geometry carries slots only (MAT-1).

Placement reports `invalid-mount`, `outside-socket` or `occupied-overlap` in that order.
Occupied bounds are caller-supplied world AABBs. Positive overlap on all axes beyond the metric
tolerance rejects the candidate at the first matching index, even when the meshes would clear.
Touching bounds are allowed. Callers can pass other obstacles through the same bounds list.
Invalid dimensions, malformed object data and invalid occupied bounds throw. The module
mutates no inputs. Returned sockets and placed objects are detached and deeply frozen.
