# House and court

A cell space, style and seeded metric block inputs yield ordered storey runs. Requested height
rounds to the nearest boundary, with ties choosing the higher one. Generic callers use regular
scale. Town composition can set scale by parcel area. A house that cannot fit both occupation
and access reports why. The object builder supplies closed solids, role slots and anchors. The
face builder supplies planar patches with openings and leaves occupied adjoining wall spans
unclad. Both work in world meters. See the fixed plots in `example.ts`.

Part addresses carry local house, part, and storey keys. `readHousePartRefs` requires a world ID
to mint refs in full-detail object order. Pass the object builder's adjoining walls to get the
same openings and contributors. Storey spans are half-open. Shared meshes list contributors
from all their cells, and ground parts attach to the first storey.
