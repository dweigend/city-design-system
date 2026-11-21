# Valley references

The scalar fixture in [valley-references.ts](../valley-references.ts) holds measured river geometry, calibration bands, and the seed lists. The four city rows are ordered Cologne, Bonn, Basel, Regensburg. Wet width is the mapped water segment across the river at a station. The width columns are in meters and are separate from generated bankfull width. The Cologne row uses a bare-earth DTM and includes relief, slope and step heights. The three DSM rows supply river geometry.

The protocol uses 2 km and 8 km squares centered on the origin, with course vertices spaced 6.25 m apart. Each measured reach needs two border contacts. Both sinuosity bands include their endpoints, and the regional ratio must exceed the local ratio for every seed and at each default shape corner at the listed bearings. The median regional ratio across the gate seeds must be in [1.12, 1.19]. The separate local median of 1.05 is a type target. The fixture also records width and surface measurement settings for the field slice.

The gate uses the six comparison seeds followed by 32 holdouts. The holdouts were fixed before tuning by calling `nextSeed` repeatedly from `VALLEY_HOLDOUT_ROOT`. The first three comparison seeds are the picture seeds.

## Executable examples

Run `bun test src/lib/catalog/data/valley-references.test.ts`. The [tests](../valley-references.test.ts) cover four examples.

1. The four city rows include ground statistics only for Cologne's DTM.
2. The measurement protocol uses 2,000 m and 8,000 m windows, 6.25 m spacing and two border contacts.
3. Picture seeds 1201, 1301 and 1409 occupy the first three positions in the six comparison seeds.
4. The 32 holdouts match the declared `nextSeed` chain and bring the total to 38 distinct seeds.
