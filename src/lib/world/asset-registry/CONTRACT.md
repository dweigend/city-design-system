# Asset registry

`listAssets(filter?)` enumerates definitions in registration order. Kind matches exactly and every requested tag must match. `readAsset(id)` reads metadata without geometry. IDs are case-sensitive ASCII, made of slash-separated lowercase kebab-case segments. Every segment starts with a letter and then uses letters or digits, with single hyphens between words.

An entry has an ID, kind, tags, numeric parameter schema, supported host kinds and a deterministic builder. `buildAsset(id, host, params, seed)` returns a detached, frozen object in world meters (LIB-2, LIB-7, LIB-11). An unknown ID raises `UnknownAssetError`. An unaccepted host kind raises `WrongAssetHostError`. A malformed parameter record, unknown key, nonnumeric or nonfinite override, or invalid seed raises `InvalidAssetParamsError`. Missing overrides use the schema defaults. Supplied numbers clamp and snap as in `core/params`. The seed follows `core/random` and is passed to builders as a uint32. Domain errors for unusable host geometry retain their original meaning.

A placement record is JSON data with `assetId`, `host`, `params` and `seed`. The host address is a world point for free ground or a kind and stable topology ID for a parcel, cell-space, lattice bay, frame, plan edge or graph edge. The caller resolves an address to this world's host before calling `buildAsset`. Persist every resolved numeric value to keep the saved defaults. Equal builder inputs rebuild equal objects with the same module version. Asset IDs do not identify individual placements. The caller owns placement identity, revision and occupancy, including whether one host may carry multiple objects.

The city composition registers court houses on parcels and cell-spaces, access on plan and graph edges, rail on graph edges, surface samples on ground points, frames on frame or lattice hosts, and seven lattice models on lattice bays. A resolved city parcel can include its full parcel site. In that case the house uses the same frontage, shared bay levels and plinth as the Architecture Town study. The rail pier reads its base and top from the edge endpoints. A station reads its position from the first endpoint and its horizontal direction toward the last. A lattice host supplies a reader for the requested model so the caller can reuse solved geometry.

## Static sculptures

`city-assets/4` adds `sculpture/portal-arch`, `sculpture/cantilever-totem` and `sculpture/plaza-canopy`.
All three build on a ground point. The ground anchor coincides with that point and faces up.
The local footprint measures the scaled geometry before rotation.
`scale` is a uniform multiplier from 0.5 to 1.5, default 1, in steps of 0.05.
`rotation` turns counterclockwise around world Z from −π to π radians, default 0, in steps of π/36.
Each builder draws once from a stream keyed by asset ID to offset the crest, crown or canopy apex along local X before scaling.
Geometry names slots. `buildAssetResult` returns each slot’s material family and role as separate metadata (MAT-1, LIB-2).

The portal frames an opening like Siah Armajani’s [Bridge Over Tree](https://www.publicartfund.org/exhibitions/view/siah-armajani-bridge-over-tree/).
The totem stacks opposing cantilevers after Ettore Sottsass’s [Carlton Room Divider](https://www.metmuseum.org/art/collection/search/486989).
The canopy turns the angular planes of Toyo Ito and Cecil Balmond’s [2002 Serpentine Pavilion](https://www.serpentinegalleries.org/about/press/serpentine-pavilion-2002/) into a pitched roof on four piers (CITY-1, CITY-9, FORM-11).
