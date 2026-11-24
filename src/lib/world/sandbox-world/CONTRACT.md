# Sandbox world

The adapter resolves private parcels from the supplied city layout and movement edges from
its ground graph. A city parcel uses the same site, columns, frontage and builder as the
Architecture Town study. It also exposes the immutable parcel plan and its polygon index.
`place` records complete resolved parameters. `restore` checks the world identity and the
registry inputs in the edit log before the caller builds active objects.

A placement cache takes transaction deltas from the document. It builds only arriving records.
A removal evicts the active object. Undoing a pure addition therefore needs no object builds.
Clear, paint and erase use the same delta. Use one cache per document, fixed world and projection.
