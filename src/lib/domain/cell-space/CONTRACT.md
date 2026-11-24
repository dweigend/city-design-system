# Cell space

Both splitters accept a counterclockwise parcel with stable corner IDs and meter coordinates.
`createCellSpace` produces corner quads and preserves their child bay identities across refinement.
`createStripSpace` anchors columns to the lowest keyed frontage edge and produces convex cells.
It retries the split with fewer rows and columns or splits the parcel into convex pieces.
Sides carry shared cell identities or tagged frontage and court edges. Each polygon carries its
shared corner IDs in vertex order. The split draws no random numbers. See the small garden-lane plot in `example.ts`.
