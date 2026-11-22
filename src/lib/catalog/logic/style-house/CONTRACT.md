# Style house

`buildStyleHouse(id, options?)` builds the example house of one construction phase: `memphis`, `archigram-fuller` or `organic`. `buildConstructionPhases(axis, phase?, inputs?)` places the three on neighbouring lots and shows how far the city has built (FORM-10).

- **Inputs.** `width` is the side of the square lot, `height` the highest point, both in metres; `complexity` (0–1) is the share of secondary parts. Omitted inputs keep `styleHouseDefaults`. Bounds are those of `blockInputs`; a value outside throws `RangeError`.
- **Space.** World metres, x right, y to the back, z up. One house has its origin at the lot centre on the ground and the footprint `[width, width]`. Hung or cantilevered parts may leave the lot by at most a quarter of its width.
- **Slots.** `geometry` carries shapes with a slot name and no surface. `slots` maps each slot to a palette token and a catalogue finish; `options.slots` replaces single slots, an unknown slot throws `RangeError`. `parts` are the same shapes dressed for the shared scene.
- **Phases.** `axis` is a unit vector in plan. The lots keep their world orientation and never overlap: the pitch is lot width plus a 4 m alley, divided by the larger axis component; the middle lot sits on the origin. Without `phase` all three houses stand finished. With phase 0, 1 or 2 that house is new, every earlier one is stock (`role: 'bestand'`, no finish, no use colour) and later lots are empty. `lots` names the centres, `active` the house under construction.
- **Order and seed.** Parts keep draw order with ids `<house id>/<index>`, houses in building order. Results are detached. The recipes draw no random numbers: equal inputs give equal houses.
- **Blocks used.** Engine primitives, the geodesic dome of the carrier family `kuppel`, the finish catalogue and `blockInputs`.

```ts
const row = buildConstructionPhases([1, 0], 1, { complexity: 1 });
scene.update(row.parts); // Memphis as stock, Archigram / Fuller new, organic lot empty
```
