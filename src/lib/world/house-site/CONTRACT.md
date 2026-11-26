# House site

A parcel house uses its permanent city parcel ID and keyed ring. The portal supplies the directed
frontage side. Edges below the cell-space minimum collapse and the public court
boundary supplies court tags. The parcel ID derives the house seed from the input seed.

The common bay levels of the block members bound the house. When given a terrain sampler,
the cell space samples inside the parcel for its floor and plinth and at the selected entrance
for its lane elevation. `createParcelSpace` exposes that terrain-clipped fine-cell and storey
space before house occupancy validation, while `createParcelHouse` returns a reason when a
parcel has no room for a house and access.

The Town study selects two adjacent perimeter blocks and a merged hall from the default plan.
Each block's placement opts into area-based scale and supplies coincident boundary walls
to face and opening derivation after the occupied spans of its houses are known.

The house recipe selects the subgrid, sizes the coarse level and its storeys, and can assign
uses and construction phases. Terrain-aware placement clips the common datum stack at the first
boundary at or above the sampled terrain, leaving at least one storey below the common roof.

## Fine cells in a coarse bay

Pass a lattice, bay ID and world scope to `readFineCells`. The resolver uses the lattice datum
and the storey heights in the supplied recipe. Each result carries a GRID-1 corner quad, a
storey ref, a fine-cell ref and six outward-wound faces in world meters. Neighbors use the same
face key and corner positions with opposite winding. The datum index stays in the ref when
storey heights change within a band.

The resolver checks the triangulated floor and ceiling over each quad. It emits a whole storey
prism when the combined model fill covers it, including any wedges addressed to neighboring
bays. The example reads the shared side of two adjacent bays with mixed-height storeys.

## Stock frames

`createParcelHouseFrame` takes the existing placed houses, frame baseline, and terrain sampler.
A level roof qualifies where its addressed storey bodies connect through to a ground plate
under the full bearing pad. The sampler checks that the plate still reaches terrain. This
keeps a detached upper house volume from taking a bearing. Volumes under the placed house parts' upper faces
reserve clearance conservatively. The result uses the structural frame contract and carries
one stable dock address per bay.
