# House and court

A cell space, style and seeded metric block inputs yield ordered storey runs. Requested height
rounds to the nearest boundary, with ties choosing the higher one. Generic callers use regular
scale. Town composition can set scale by parcel area. A house that cannot fit both occupation
and access reports why. The object builder supplies closed solids, role slots and anchors. The
face builder supplies planar patches with openings and leaves occupied adjoining wall spans
unclad. Both work in world meters. See the fixed plots in `example.ts`.

Part addresses carry local house, part, and storey keys. `readHousePartRefs` lists full-detail
parts and addresses each envelope or stacked body slice by cell and datum index. The object
builder can combine several of those slices into one mesh. Pass its adjoining walls to get the
same openings. Reference reads leave 3D face construction and triangulation for object assembly.
Storey spans use half-open datum indices. Shared parts list contributors from all their cells,
and ground parts attach to the first active storey.

A site can assign phase and use to each occupied storey by datum index and cell ID. The house
keeps those assignments with the occupancy. A part with one common assignment carries it in its
address. Programmed bodies are drawn in separate layers so each use can be highlighted.
