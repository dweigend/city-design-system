# Style house

`buildStyleHouse(id, options?)` builds the example house of one construction phase: `memphis`, `archigram-fuller` or `organic`. The three recipes share one lot and one set of block inputs, so only the way of building differs.

- **Inputs.** `width` is the side of the square lot, `height` the highest point, both in metres; `complexity` (0–1) is the share of secondary parts. Omitted inputs keep `styleHouseDefaults`. Bounds are those of `blockInputs`; a value outside throws `RangeError`.
- **Space.** World metres, origin at the lot centre on the ground, x right, y to the back, z up. The footprint is `[width, width]`. Hung or cantilevered parts may leave the lot by at most a quarter of its width.
- **Slots.** `geometry` carries shapes with a slot name and no surface. `slots` maps each slot to a palette token and a catalogue finish; `options.slots` replaces single slots, an unknown slot throws `RangeError`. `parts` are the same shapes dressed for the shared scene.
- **Order and identity.** Parts keep draw order with ids `<house id>/<index>`. The result is detached.
- **Seed.** The recipes draw no random numbers. Equal inputs give equal houses.
- **Blocks used.** Engine primitives, the geodesic dome of the carrier family `kuppel`, the finish catalogue and `blockInputs`.

```ts
const house = buildStyleHouse('organic', { inputs: { height: 18, complexity: 1 } });
scene.update(house.parts);
```
