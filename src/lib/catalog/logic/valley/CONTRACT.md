# Valley

`generateValley({ seed, parameters? })` returns one large-lowland main stem as a `valley/1` snapshot. `seed` must be an integer in [0, 2³²). The result carries the seed, version and course. The course contains interleaved world XY coordinates, downstream chainage from zero and one bankfull width, all in meters. Its middle vertex lies at the origin and its endpoints reach beyond the centered 8 km square. Consecutive vertices are 6.25 m apart up to floating-point roundoff.

The snapshot and its course record are frozen. Each call gives the caller its own coordinate and chainage buffers. The same seed and parameters reproduce their bytes in the same runtime.

| Parameter band      | Default        | Valid bounds                                             |
| ------------------- | -------------- | -------------------------------------------------------- |
| `bankfullWidthM`    | 340–420 m      | 320–420 m                                                |
| `wavelengthToWidth` | 11.5–13.2      | 10–14                                                    |
| `headingAmplitude`  | 0.53–0.65 rad  | 0 to the minimum wavelength-to-width ratio divided by 4π |
| `phaseOffset`       | −0.14–0.14 rad | −π/4 to π/4                                              |

Pass an ordered pair of finite values to override a band. A pair with equal endpoints fixes that parameter. Invalid seeds throw a `RangeError` with message `invalid-seed`. Invalid bands throw `invalid-valley-parameters`. Validation precedes course allocation.

Draws use `core/random.hash(seed, 0, channel)`, with main-stem ID 0. Channel 0 sets the mean bearing, 1 offsets the central low-curvature reach, 2 sets amplitude and wavelength together, and 3 sets width. The generator integrates a cosine heading at segment midpoints. The amplitude limit keeps the heading derivative at or below the reciprocal of twice the bankfull width.

## Executable examples

Run `bun test src/lib/catalog/logic/valley/valley.test.ts`. The [tests](valley.test.ts) exercise these five cases.

1. Generate 1201, 1301 and 1201. The two seed-1201 courses have the same bytes and independent buffers.
2. Seeds 0 and 2³²−1 are valid. Negative, fractional, nonfinite and too-large seeds throw.
3. The middle vertex is at the origin. Chainage starts at zero and advances 6.25 m for every segment.
4. A width pair of [400, 400] fixes the bankfull width at 400 m. A parameter band that allows a tighter bend than twice the width throws.
5. For all 38 frozen seeds, the default course crosses each square with two border contacts. The independent instrument measures S₂ in [1.00, 1.11] and S₈ in [1.05, 1.30], with S₈ greater than S₂ for each seed.
