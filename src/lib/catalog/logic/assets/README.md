# Sandbox assets

Import `assetRegistry` and `buildObject` from `logic/assets`. Use the registry's stable asset and variant IDs. Each recipe receives one independent sample keyed by unsigned seed, asset ID and variant ID. Pass `instanceId` to namespace part IDs within a structure.

A footprint reserves local plan dimensions in metres across all seeds and variants. Deck and roof reservations are centred on the origin in x and y. Facades occupy x from zero to the reserved depth and are centred along y. Each anchor is an alternative mounting surface at the local origin. Align the local normal to the outward host normal and translate the origin to the host attachment point. Local z is up. Rotations are radians. Footprints include placement clearance.

The contact sheet photographs the game's structure batches on the bible's parametric vignette stage. The game and bible project solids through `scene/primitive-geometry` and resolve explicit finishes through the same material and surface chart.

For a facade, roof or deck with its own geometry, spread `getAssetSurface('terrazzo', 'water-chip')` onto its primitive. The returned `material`, `finish` and `token` use the ordinary sandbox finish pipeline. The surface category also supplies folded samples for inspecting each treatment.

## Material slots

Use `buildObject(id, variant, seed, { slots, instanceId })` for every registered object, including house bodies and the `primitive-forms` group. Both options are optional. The result contains local `geometry`, `footprint`, `anchors`, slot `defaults` and dressed `parts` for the shared scene engine. Each geometry member names its slot and carries only shape and placement data. The registry lists the union of slot names across an object's variants. Inspect `entry.slotDefaults[variant]` to populate a material picker before building any geometry. Passing the suggested slots back to the builder reproduces the original appearance.

For example, `buildObject('porthole', 'round', 17, { slots: { body: { finish: 'holz-natur', token: '--body-living' } } })` binds timber to the frame and uses the suggested glass treatment. Every slot accepts any catalogue finish and palette token. An unknown slot raises a RangeError. Recipes can suggest a physical finish per slot. Unassigned bodies use molded polymer. Large legacy slot sets can share visual defaults while keeping all saved overrides independent. Frame, glass, deck and plaza slots suggest satin paint, clear acrylic, timber and terrazzo respectively. When a slot resolves to `city-drawing`, `buildObject` omits `finish` from the dressed part so the scene uses the original drafting treatment. Other finishes use the shared finish compiler. The materials contact sheet shows the same porthole in three assignments.
