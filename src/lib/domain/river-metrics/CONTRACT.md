# River metrics

`measureRiver(river, waveCourse?)` takes downstream XY vertices, the wet and bankfull widths in meters, and the mean downstream bearing in radians from +X.
It returns the channel length and endpoint chord in meters, their unitless ratio, and wavelength divided by bankfull width.
Wavelength is twice the mean along-channel distance between consecutive crossings of the mean heading. A reach with fewer than two crossings yields null. Supply a longer course to measure wavelength beyond the reach.
`sinuosity(xy)` validates and divides interleaved XY length by its chord.
`clipPolylineToSquare(xy, size)` returns the longest contiguous reach in the centered square in input order, first on ties, with a detached buffer or null.
Distinct border contacts count once, including tangencies. A border overlap yields infinite contacts.
`measureRiverSurface(grid, course, protocol)` reads a centered north-first grid of bed and water millimeters and downstream course meters.
It interpolates zero crossings for wet widths, raises bed to water for Gaussian-smoothed relief and land slope shares, and measures signed terrace step gains.
With floor samples, the half-height crossing of the interpolated terrace mask gives paired and individual dry bank widths in meters. Censored measurements are omitted.
These operations leave inputs untouched. Malformed geometry, windows or grids throw RangeError.
The contract tests use independent line, arc, sine and synthetic-bank fixtures.
