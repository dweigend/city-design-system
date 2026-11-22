# Valley

Kind: block
Purpose: Generates a seeded river valley and samples its terrain and mean water elevations.
Exports: generateValley, sampleValley, groundAt, meanWaterAt
Outputs: A detached valley snapshot and sampled fields with water, floodplain and terrace classifications. The field owns its buffers.
Input: seed | number | — | Integer in [0, 2³²) | Required
Input: bearingRad | number | rad | Finite, normalized modulo 2π | Seeded
Input: groundProfile | Partial<ValleyGroundProfile> | Per field | See Ground profile | Valley ground defaults
Input: windowM | number | m | 2,000 | Required for sampleValley
Input: spacingM | number | m | 12.5 | Required for sampleValley
Input: bankfullWidthM | readonly [number, number] | m | 320–450 | 350–430
Input: wavelengthToWidth | readonly [number, number] | Ratio | 10–26 | 21–24
Input: headingAmplitude | readonly [number, number] | rad | 0 to the smaller of 1.2 and the minimum ratio / 4π | 0.71–0.79
Input: phaseOffset | readonly [number, number] | rad | −π/4 to π/4 | −0.06–0.06 rad
Input: windowPhaseOffset | readonly [number, number] | rad | −π to π | −π to π
Input: windowAcross | readonly [number, number] | Ratio | −1 to 1 | −1 to 1
Input: groundVariation | readonly [number, number] | Ratio | 0 to 1 | 0–1
Input: groundHeightVariation | readonly [number, number] | Ratio | 0 to 1 | 0–1
Input: axisTiltRad | readonly [number, number] | rad | −0.15 to 0.15 | −0.052–0.052
Input: openBank | left or right | — | Left or right viewed downstream | Seeded
Input: wetToBankfullWidth | number | Ratio | Greater than 0 and at most 1 | 0.94
Example: logic/valley-study

`generateValley({ seed, bearingRad?, parameters?, groundProfile? })` returns a `valley/5` snapshot. It contains the main stem, its valley axis, ground profile, ordered floors and an empty list of tributaries. The course stores interleaved XY coordinates, downstream chainage, bankfull and wet widths, the frame and mean bearings, the two phase offsets and the signed window offset. Lengths are in meters and angles are in radians. Vertices are 6.25 m apart up to floating-point roundoff. The course reaches beyond the centered 8 km square.

`valley/5` moves the window along and across the course, widens the bend spacing, and gives the ground its own height and tilt draws. Course coordinates and field arrays differ from those of `valley/4`. Replaying earlier output requires its original generator. Snapshot records and profile bands are frozen. Each call owns its coordinate and chainage buffers. The same seed, version, bearing and parameters reproduce their bytes in the same runtime.

Pass finite ordered pairs for bands. Equal endpoints fix that parameter. Invalid bands throw `RangeError('invalid-valley-parameters')`. A seed must be an integer in [0, 2³²), or generation throws `RangeError('invalid-seed')`. A supplied `bearingRad` must be finite. It is reduced modulo 2π to select the sampling frame, or generation throws `RangeError('invalid-bearing')`. Validation precedes course allocation.

## Window and course

Draws use `core/random.hash(seed, 0, channel)`. Channel 0 selects the default frame bearing. Channel 1 sets the base phase. Channel 2 pairs heading amplitude and wavelength, and channel 3 sets bankfull width. Channel 4 adds one full-period window phase draw. Channel 5 selects the open bank. Channel 7 selects the side and magnitude of the cross-course shift.

The generator offsets the origin along the normal to the chord at ±1 km of chainage from the middle vertex. It shifts 185–285 m toward the close bank or 375–430 m toward the open bank. The sign of `windowAcross` selects the downstream right or left side. Zero selects left. The magnitude interpolates the distance band. The regional mean bearing is the frame bearing minus 22–62% of the central heading deflection. Larger offsets align more of the local heading toward the frame to keep room for the river. The course integrates the periodic heading once at segment midpoints.

`wetWidthM` is bankfull width times `wetToBankfullWidth`. The defaults give a nominal wet width of 329–404.2 m. The field gates measure the actual wet interval independently.

## Millimeter fields for sampling

`bedMm` and `meanWaterMm` store the field elevations. Their source values are the computed bed and local mean-water elevations in Float64 meters relative to mean water at the origin. For each value, multiply by 1,000 and round once with `Math.round`. Exact half-millimeter ties in the scaled value round toward positive infinity, for example −1.5 mm to −1 mm and 1.5 mm to 2 mm. Store zero as 0.

Reject nonfinite meter inputs with `RangeError('invalid-height-m')`. A rounded value outside the signed 32-bit range [−2,147,483,648, 2,147,483,647] throws `RangeError('height-mm-overflow')` before storage. The field uses those integers for elevation comparisons. Identical meter inputs round the same way in Bun and the browser. The vector course is quantized to millimeters before the raster projection. Cross-runtime equality is measured for the three study seeds.

## Executable examples

Run `bun test src/lib/catalog/logic/valley/valley.test.ts` in `heavy-slot`. The [tests](valley.test.ts) exercise these cases.

1. Generate 1201, 1301 and 1201. The two seed-1201 courses have the same bytes and independent buffers.
2. Seeds 0 and 2³²−1 are valid. Negative, fractional, nonfinite and too-large seeds throw.
3. The middle vertex is `abs(windowOffsetM)` meters from the origin. Chainage starts at zero and advances 6.25 m per segment.
4. A width pair of [400, 400] fixes the bankfull width at 400 m. A parameter band that allows a tighter bend than twice the width throws.
5. A 400 m bankfull width gives a 376 m wet width at the default ratio and 340 m at a ratio of 0.85.
6. For all 38 frozen seeds, the default course crosses each square with two border contacts. The independent instrument measures S₂ in [1.00, 1.11] and S₈ in [1.05, 1.30], with S₈ greater than S₂ for each seed and median S₈ in [1.12, 1.19].
7. The same per-course gates hold at both endpoints of width, phase and the shared curvature draw at bearings from 0° to 90° in 15° steps. The wet-width proxy passes its band on the 38 courses and at the corners.

## Field

`sampleValley(valley, { windowM: 2000, spacingM: 12.5 })` accepts exactly this grid. Other pairs throw `RangeError('invalid-valley-grid')`. The returned frozen record includes seed, version, window and spacing. Its 161² entries are in row-major order with row zero north, column zero west and both endpoints included. Each call owns its four buffers. The rows are oriented to the XY frame supplied at generation.

`bedMm` and `meanWaterMm` are signed integer elevations. `floor` is 0 for water, 1 for floodplain, 2 for lower terrace and 3 for upper terrace. `classes` uses 1 for water, 2 for floodplain, 4 for terrace and 32 as an additional high-terrace bit. At the shoreline the bed is wet exactly when its integer height is below mean water. Terrace indices change at the integer midpoint of the corresponding rise.

`contains(field, x, y)` checks the closed window and rejects nonfinite coordinates. `groundAt` and `meanWaterAt` linearly interpolate between samples in both axes and return meters. For a coordinate outside the window they throw a RangeError with message and code `outside-window`.

## Coupled bend parameters

Amplitude and wavelength-to-width share channel 2. The default pairs range from (0.71 rad, 21) to (0.79 rad, 24). Longer bends keep S₂ in band over the wider window placement. A short-wavelength override can still leave the band. A 350 m river with amplitude 0.79, wavelength ratio 11.5, base phase 0 and window phase 0.45 passes at 0° and exceeds S₂ = 1.11 at 40° for seed 14.

A course with overridden parameters or an explicit bearing is clipped and checked in its actual sampled 2 km frame. An offending course throws `RangeError('valley-sinuosity-out-of-band')`. The study and box use this same bearing option.

## Ground profile

The axis starts at the middle course vertex and follows the chord at ±`axisReachM` chainage. The chord's sideways displacement supplies a quadratic bow with linear extensions, and channel 9 tilts its bearing. Channel 6 samples edge setbacks, flare and bow gain. Channel 8 independently samples both terrace rises. The land elevations follow this axis beyond the channel and bank skirt. The along-axis grade sets mean water with its datum at the frame origin.

Pass `groundProfile` with any subset of the [ground defaults](../../data/valley-ground.ts) to replace the corresponding values. The profile and its bands are copied into the snapshot. The close edge band must end below the start of the open edge band. Length limits are 0.001–3,000 m unless stated otherwise. Axis reach must be at least 6.25 m. Widening may be signed, apron rise may be zero, bow gain is in [0, 2] and downstream fall in [0, 1]. Invalid values throw `RangeError('invalid-valley-ground')`. The study requests frame bearing −π/2 and uses the default ground profile.
