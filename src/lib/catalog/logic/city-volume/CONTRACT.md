# City volume

`deriveCityVolume(plan, options?)` lifts the shared ground vertices in world XY metres, Z up. The seeded plan supplies all addresses and both district centres.
The terrain-relative canopy interpolates linearly along the dense-to-detached centre axis and holds each endpoint height beyond its centre. Options `denseHeightM` and `lowHeightM` default to 24 and 7 m within the common 1–32 m height range.
One positive plan path clearance lies below both canopy heights. All columns share the ground, clearance and canopy surfaces.
Convex planar sections keep their quad footprint. Other columns use the terrain 0–2 diagonal throughout. A topology change can retire a coarse address.
`coarse` includes both layers. In `leaves` two side-adjacent upper cells split into corner quads and two half-height intervals. Their unrefined neighbours share every contact patch.
`refineGroundPair` takes two adjacent ground IDs. By default the anchor and its lexically first neighbour supply the pair. Pass the retained pair to keep a selection through crop extension.
Each binding locates one leaf by its ground source, layer and coarse parent. Child IDs append the split rule, ground corner and vertical slot. Unrefined leaves retain the parent ID.
`occupancy` starts empty on every leaf. Pass `leaves`, `occupancy` and `reservations` to `occupyCells`. Path owners protect the lower layer. Open-to-sky owners protect both.
Example: `deriveCityVolume(deriveGroundPlan(grid, '76/64', 104), { denseHeightM: 28 })`.
