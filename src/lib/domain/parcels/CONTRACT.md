# Parcels

`createParcelPlan` takes a fixed XY carrier, width reservations, ordered pair proposals
and a holding program. Its `read` method selects whole blocks. Rings close implicitly,
with the outer ring counterclockwise and holes clockwise. Coordinates are in meters.
Booleans use local integer coordinates with a quantum of one fourth of the linear tolerance.
Each axis rounds to the nearest quantum with ties toward positive infinity. A snapshot reports its linear tolerance.
See the [address table](../../world/sandbox-world/CONTRACT.md#local-addresses) for local keys.
Realized parcels include keyed corners. A frontage portal's directed side names two consecutive
corners in the parcel ring, independent of the ring's starting vertex.
Lane reserves extend into the incident block, with local joins at shared corners.
An undersized net component becomes open public ground.
Gross block area accounts for reserved lanes, court, passage, open ground and parcels.
The module draws no random numbers. The exhibition example uses six cells and two walkways.
