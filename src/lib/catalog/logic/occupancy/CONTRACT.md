# Occupancy

`createOccupancy(space)` returns one empty fill per cell. A fill is `empty`, `bridge` with a connection ID, or `house` with house and room IDs. Reservations map protected cell IDs to owner IDs independently of fills.

`occupyCells(space, current, reservations, writes)` returns a detached map in lexical cell ID order. An empty write clears an unreserved cell. Assigning a bridge or house requires an empty cell. The full batch fails with `RangeError` for unknown and duplicate targets, reservations, conflicts or a map that fails to cover the space exactly. Inputs stay intact on every outcome. The house-court test exercises bridge and court conflicts.
