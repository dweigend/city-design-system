# Sandbox world

The adapter resolves private parcels and ground movement edges in a fixed city. A city house
uses the registry's style and the same terrain sampler, strip space and scale as Town.
A valid parcel with no room for a house retains its address and returns a garden reason.
`place` records complete resolved parameters. `restore` checks the world and the log's
registry inputs before replacing the document.

The placement cache stages a delta before publishing it. It resolves incoming occupancy once
and rebuilds only changed records and surviving houses whose party-wall exposure changes.
Removed placements evict their objects. Use one cache per document, fixed world and projection.
