# House and court

A cell space, style and seeded metric block inputs yield ordered storey runs. Requested height
rounds to the nearest boundary, with ties choosing the higher one. Generic callers use regular
scale. Town composition can set scale by parcel area. A house that cannot fit both occupation
and access reports why. The object builder supplies closed solids, role slots and anchors. The
face builder supplies planar patches with openings and leaves occupied adjoining wall spans
unclad. Both work in world meters. See the fixed plots in `example.ts`.

`readHousePartRefs` lists the full-detail parts in object order. Its keys encode the house ID
and part ID. The storey span is half-open. A shared mesh has no single cell ID and lists the
storeys contributed by all its cells. Ground parts are attached to the first storey of their
cell. External callers can use the references as keys for their own data.
