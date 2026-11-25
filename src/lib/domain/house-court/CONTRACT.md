# House and court

A cell space, style and seeded metric block inputs yield a house from the ordered storey runs
planned by [massing](../massing/CONTRACT.md). The object builder supplies closed solids, role
slots and anchors. The face builder supplies planar patches with openings and leaves occupied
adjoining wall spans unclad. Both work in world meters. See the fixed plots in `example.ts`.

Part addresses carry local house, part and storey keys. `readHousePartRefs` lists full-detail
parts and addresses each envelope or stacked body slice by cell and datum index. The object
builder can combine several slices into one mesh. Pass its adjoining walls to get the same
openings. Reference reads leave face construction and triangulation for object assembly.
Storey spans use half-open datum indices. Shared parts list contributors from all their cells,
and ground parts attach to the first active storey. A part with one common phase and use carries
it in its address. Programmed bodies draw in separate layers so each use can be highlighted.
