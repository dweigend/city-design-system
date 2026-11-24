# Planar topology

Pass faces in the desired order, with unique string IDs and simple, consistently wound
vertex rings. Rings close implicitly. Topology uses exact vertex IDs and has no units.
An undirected side pairs only when both endpoint IDs match. Repeated sides within one
face and third incidences throw `RangeError`.

- `readEdgeIncidence(faces)` lists edges in first-incidence order. Each entry carries
  the first directed side and any opposite face and side index.
- `createPlanarTopology(faces)` snapshots each face with one neighbor per ring side.
  An unpaired side has a null neighbor and appears in the directed `boundary`.
- `readPlanarSubset(faces, ids)` reads already paired faces in first request order.
  Unknown IDs throw. Removed neighbors become null. Boundary sides follow the new face
  and side order. `hasVertex` tests whether the subset uses an ID. The subset shares
  input rings and any caller-owned metadata.
- `readVertexAdjacency(faces, isBoundary?)` lists vertices and their neighbors in
  first-incidence order. Boundary neighbors share an unpaired side by default.
  A predicate can identify a cut from the two incident face IDs, with null for a
  missing second face.
- `readFaceUnionBoundary(faces, canJoin?)` cancels paired sides and walks the remaining
  directed cycle from the smallest vertex ID in UTF-16 order. A predicate can protect
  shared sides from joining. The faces must join in a tree and leave one simple ring.
  The result is undefined for disconnected faces, a protected seam, inconsistent seam
  winding, or a union outside those bounds.

Pairing and boundary extraction take time and space linear in the number of sides.
Subsets index the input faces and scan only the chosen sides. Each query freezes the
data it creates. The [example](example.ts) pairs two faces, selects one, and walks the
two-face union boundary.
