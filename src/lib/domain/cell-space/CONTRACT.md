# Cell space

`createSubgridSpace` selects corner quads or frontage strips by catalog ID. Callers can supply
a catalog with additional rules. All use counterclockwise parcels with stable corner IDs in
meters. Corner quads preserve their child bay identities across refinement. Strips follow the
lowest keyed frontage edge and retry with fewer rows or columns or split into convex pieces.
Sides carry shared cell identities or tagged frontage and court edges. The split draws no random
numbers. See the garden-lane plot in `example.ts`.

Parcels specify a uniform height or an ordered stack of storey heights. The stack exposes each
boundary from base to roof. `createCellSpaceStoreys` changes the sizing and keeps the subdivision.
`readCellStoreys` lists world-scoped references in cell and vertical order. Their keys encode the
space ID, cell ID and zero-based storey index, so moving the datum or adding storeys above the
current roof preserves existing slice identities.
