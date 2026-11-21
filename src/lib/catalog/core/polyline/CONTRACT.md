# Polyline

Pure measurements on finite interleaved XY vertices, with lengths in the caller's linear unit. `pointAt` reads an XY pair at a flat index and `distance` computes its Euclidean separation from another point. `clipPolylineToSquare` returns the longest contiguous reach of a closed square centered at the origin. `sinuosity` returns arc length divided by endpoint distance. The [river metrics contract](../../logic/river-metrics/CONTRACT.md) gives exact clipping behavior, errors and executable examples.
