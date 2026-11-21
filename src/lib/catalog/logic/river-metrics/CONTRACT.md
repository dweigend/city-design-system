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
