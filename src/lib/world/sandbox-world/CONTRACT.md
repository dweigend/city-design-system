# Sandbox world

The adapter resolves private parcels and ground movement edges in a fixed city. Its size comes
from the resolved layout, and its identity includes terrain and topology revisions. A city house
uses the registry's style and the same terrain sampler, strip space and scale as Town.
A valid parcel with no room for a house retains its address and returns a garden reason.
`place` records complete resolved parameters. `restore` checks the world and the log's
registry inputs for every staged edit, including discarded operations and redo history.

The placement cache stages a delta before publishing it. It resolves incoming occupancy once
and rebuilds only changed records and surviving houses whose party-wall exposure changes.
Removed placements evict their objects. Each cache attaches to exactly one document.
