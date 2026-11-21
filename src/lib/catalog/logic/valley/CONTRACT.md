# Valley

`generateValley({ seed, parameters? })` returns one large-lowland main stem as a `valley/3` snapshot. `seed` must be an integer in [0, 2³²). The result carries the seed, version and course. The course contains interleaved world XY coordinates, downstream chainage from zero, bankfull width and a derived wet width, all in meters. It also carries the mean bearing, valley slope, ordered floors and an empty list of tributaries. Its middle vertex lies at the origin and its endpoints reach beyond the centered 8 km square. The generator sets the vertex spacing at 6.25 m, up to floating-point roundoff.

The snapshot and its course record are frozen. Each call gives the caller its own coordinate and chainage buffers. The same seed, generator version and parameters reproduce their bytes in the same runtime. `valley/2` changes the default amplitudes and widths, so a seed from `valley/1` now gives a different course. Replay of `valley/1` output requires its original implementation. The first field uses `valley/3` because it adds floors, slope and sampling to the snapshot. The default vector course retains its `valley/2` coordinates.

| Parameter            | Default        | Valid bounds                                             |
| -------------------- | -------------- | -------------------------------------------------------- |
| `bankfullWidthM`     | 350–430 m      | 320–450 m                                                |
| `wavelengthToWidth`  | 11.5–13.2      | 10–14                                                    |
| `headingAmplitude`   | 0.71–0.79 rad  | 0 to the minimum wavelength-to-width ratio divided by 4π |
| `phaseOffset`        | −0.14–0.14 rad | −π/4 to π/4                                              |
| `wetToBankfullWidth` | 0.94           | Greater than 0 and at most 1                             |

`DEFAULT_VALLEY_PARAMETERS` exposes the frozen defaults. Pass an ordered pair of finite values to override a band. A pair with equal endpoints fixes that parameter. `wetToBankfullWidth` is a single finite ratio. Invalid seeds throw a `RangeError` with message `invalid-seed`. Invalid parameters throw a `RangeError` with message `invalid-valley-parameters`. Validation precedes course allocation.

Draws use `core/random.hash(seed, 0, channel)`, with main-stem ID 0. Channel 0 sets the mean bearing, 1 offsets the central low-curvature reach, 2 sets amplitude and wavelength together, and 3 sets width. The generator integrates a cosine heading at segment midpoints. The amplitude limit keeps the heading derivative at or below the reciprocal of twice the bankfull width.

`wetWidthM` is the bankfull width multiplied by `wetToBankfullWidth`, a constant ratio along the course. At the defaults that puts the wet-width proxy between 329 and 404.2 m. The width ratio controls lateral extent. The field's local mean-water elevation will have its own longitudinal profile.

## Millimeter fields for sampling

`bedMm` and `meanWaterMm` store the field elevations. Their source values are the computed bed and local mean-water elevations in Float64 meters relative to the mean water at the course point nearest the origin. For each value, multiply by 1,000 and round once with `Math.round`. Exact half-millimeter ties in the scaled value round toward positive infinity, for example −1.5 mm to −1 mm and 1.5 mm to 2 mm. Store zero as 0.

Reject nonfinite meter inputs with `RangeError('invalid-height-m')`. A rounded value outside the signed 32-bit range [−2,147,483,648, 2,147,483,647] throws `RangeError('height-mm-overflow')` before storage. The field uses those integers for elevation comparisons. Identical meter inputs round the same way in Bun and the browser. The vector course is quantized to millimeters before the raster projection. Cross-runtime equality is measured for the three study seeds.

## Executable examples

Run `bun test src/lib/catalog/logic/valley/valley.test.ts` in `heavy-slot`. The [tests](valley.test.ts) exercise these cases.

1. Generate 1201, 1301 and 1201. The two seed-1201 courses have the same bytes and independent buffers.
2. Seeds 0 and 2³²−1 are valid. Negative, fractional, nonfinite and too-large seeds throw.
3. The middle vertex is at the origin. Chainage starts at zero and advances 6.25 m for every segment.
4. A width pair of [400, 400] fixes the bankfull width at 400 m. A parameter band that allows a tighter bend than twice the width throws.
5. A 400 m bankfull width gives a 376 m wet width at the default ratio and 340 m at a ratio of 0.85.
6. For all 38 frozen seeds, the default course crosses each square with two border contacts. The independent instrument measures S₂ in [1.00, 1.11] and S₈ in [1.05, 1.30], with S₈ greater than S₂ for each seed and median S₈ in [1.12, 1.19].
7. The same per-course gates hold at both endpoints of width, phase and the shared curvature draw at bearings from 0° to 90° in 15° steps. The wet-width proxy passes its band on the 38 courses and at the corners.

## Field

`sampleValley(valley, { windowM: 2000, spacingM: 12.5 })` accepts exactly this grid. Other pairs throw `RangeError('invalid-valley-grid')`. The returned frozen record includes seed, version, window and spacing. Its 161² entries are in row-major order with row zero north, column zero west and both endpoints included. Each call owns its four buffers.

`bedMm` and `meanWaterMm` are signed integer elevations. `floor` is 0 for water, 1 for floodplain, 2 for lower terrace and 3 for upper terrace. `classes` uses 1 for water, 2 for floodplain, 4 for terrace and 32 as an additional high-terrace bit. At the shoreline the bed is wet exactly when its integer height is below mean water. Terrace indices change at the integer midpoint of the corresponding rise.

`contains(field, x, y)` checks the closed window and rejects nonfinite coordinates. `groundAt` and `meanWaterAt` linearly interpolate between samples in both axes and return meters. For a coordinate outside the window they throw a RangeError with message and code `outside-window`.
