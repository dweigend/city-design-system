# River metrics

Both functions take interleaved world XY coordinates in meters. They read the vertices in the given order and leave the input alone.

`clipPolylineToSquare(xy, size)` clips the segments to the closed square centered at the origin. The side length `size` must be finite and positive. The function interpolates the border intersections and selects the longest contiguous reach by length. On a tie it keeps the first reach. Corner-only contact yields an empty clip. The result is `null` when there is no positive-length reach. Otherwise the result has a detached `xy` buffer and a `borderHits` count. A shared vertex on the border counts once, including a tangent vertex. A positive-length border overlap yields `Infinity` for the count.

`sinuosity(xy)` divides the sum of segment lengths by the distance between the first and last vertices. Polygonal samples of a curve converge to the analytic ratio as the spacing tends to zero.

Both functions reject malformed coordinates, zero-length segments and nonfinite lengths with a `RangeError` whose message is `invalid-polyline`. Clipping reports `invalid-window` for an invalid side length. Sinuosity reports `zero-chord` for coincident endpoints and `non-finite-sinuosity` if the ratio overflows.

## Executable examples

Run `bun test src/lib/catalog/logic/river-metrics/river-metrics.test.ts`. The [tests](river-metrics.test.ts) exercise these five cases.

1. Clip the line from (−4, −2) to (4, 2) to a 2 m square. Its endpoints are (−1, −0.5) and (1, 0.5), and its sinuosity is 1.
2. A unit semicircle sampled in 65,536 intervals approaches π/2 within 10⁻⁹.
3. One period of a sampled sine curve agrees with independent Simpson quadrature within 10⁻⁶.
4. A course that leaves and reenters the square returns its longest reach, with an exact tie resolved by input order.
5. A corner crossing contributes one hit, a tangent vertex contributes one hit and a border overlap yields infinite hits. Invalid and degenerate inputs follow the errors above.

## Surface measurements

`measureRiverSurface(grid, course, protocol)` takes a centered north-first square of bed and local mean water in millimeters and the downstream course in meters. It finds complete wet intervals on cross-sections using linear zero crossings. For relief, slope and steps it raises wet samples to mean water, bilinearly resamples and applies a separable Gaussian with reflected edges. Slope bins count dry land at the common-grid sample centers. The centered gradient uses one-sided differences at the edge. Each profile's contiguous steep runs use signed gradients so forward and reverse rises both count. The unfinished run at a clipped end is censored.

The result contains arrays of measured widths and step gains in meters, the smoothed core relief in meters and normalized shares for each land slope class in ascending order. An optional `floor` grid also yields `bankPairsM`. Each pair gives the dry distance from the left and right wet banks to the first terrace, in downstream order. The terrace edge is the 50% crossing of the bilinearly interpolated mask of floor 2 and above. A censored or absent measurement contributes no entry to its array.

`dryBankWidthsM` also returns individual dry widths so an immediate terrace contact stays measurable when the opposite terrace is censored. Such a contact contributes zero.
