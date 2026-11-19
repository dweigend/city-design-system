# Sandbox assets

Import `assetRegistry` and `buildAsset` from `logic/assets`. Look up the stable asset and variant IDs in the registry. A call such as `buildAsset('porthole', 'ringed', 17, 'house-12/east-window')` returns fresh sandbox primitives in deterministic assembly order. The last argument namespaces part IDs within a structure. Each recipe receives one independent sample keyed by unsigned seed, asset ID and variant ID.

A footprint reserves local plan dimensions in metres across all seeds and variants. Deck and roof reservations are centred on the origin in x and y. Facades occupy x from zero to the reserved depth and are centred along y. Each anchor is an alternative mounting surface at the local origin. Align the local normal to the outward host normal and translate the origin to the host attachment point. Local z is up. Rotations are radians. Footprints include placement clearance.
