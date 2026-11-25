# Cell space

`createSubgridSpace` selects corner quads or frontage strips by catalog ID. Callers can supply
a catalog with additional rules. All use counterclockwise parcels with stable corner IDs in
meters. Corner quads preserve their child bay identities across refinement. Strips follow the
lowest keyed frontage edge and retry with fewer rows or columns or split into convex pieces.
Sides carry shared cell identities or tagged frontage and court edges. A subdivision can declare
a minimum width and require a connected house entrance. The split draws no random numbers. See
the garden-lane plot in `example.ts`.

Parcels specify a uniform height or an ordered stack of storey heights. The stack exposes each
boundary from base to roof. `createCellSpaceStoreys` changes the sizing and keeps the subdivision.
Storeys appear in cell order, from bottom to top. `readCellStoreys` takes a world ID to mint refs.
Keys encode the space ID, cell ID and signed datum index. Clipping the base or extending the
roof changes the active window and preserves the keys of its surviving storeys.
