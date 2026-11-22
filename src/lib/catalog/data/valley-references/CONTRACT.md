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

## Ground gates

Sample the complete 2,000 m square on the 12.5 m grid. On the clipped course, start at 125 m of chainage and measure every 250 m. Each normal uses the chord from 60 m before to 60 m after its station, clipped to the reach. Sample signed bed minus mean water every 12.5 m using bilinear interpolation of the field. Interpolate its zero crossing linearly between neighboring profile samples to estimate each bank to sub-cell precision. Measure the connected wet interval containing the course. A boundary-censored interval is omitted and each case requires at least one complete station. Every complete width must be in [320, 420] m.

Fill wet terrain to its local mean water before resampling at 30 m. Gaussian smoothing uses σ = 30 m and a four-sigma radius. Measure relief over the central 1 km square and report slope classes over land in the full window. Detect contiguous signed gradients over 5% on the smoothed 12.5 m profiles within 1 km either side of the station. Keep gains of at least 3 m and apply the step gates to linearly interpolated percentiles of all candidates in each case. Ground comparison columns come from the DTM row only.

Run the same field gates for the 38 seeds and at both endpoints and the midpoint of default width, phase, the paired curvature draw, window placement and ground variation, at each protocol bearing and for each open bank. The grid of cases samples the parameter box.

## Form gates

For each case, require a step-height spread of at least 2.25 m from p10 to p90. Measure the dry floodplain from each interpolated wet bank to the first 50% crossing of the bilinearly sampled terrace mask. Use only cross-sections with both banks and both terrace crossings, and require at least two complete pairs. Divide the larger side's median width by the smaller side's median width. Require a ratio of at least 2. A reach with no floodplain on one bank may have an unbounded ratio.

Compare each pair of picture seeds in the common study frame. For each mask, divide the count of points in exactly one seed's mask by the count in either seed's mask. Require a wet-mask difference of at least 10% and a floodplain-mask difference of at least 20%. These are calibration levels for the study's form.
