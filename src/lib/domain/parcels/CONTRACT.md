# Parcels

`createParcelPlan` takes a fixed XY carrier, width reservations, ordered pair proposals
and a holding program. Its `read` method selects whole blocks. Rings close implicitly,
with the outer ring counterclockwise and holes clockwise. Coordinates are in meters.
Booleans use local integer coordinates with a quantum of one fourth of the linear tolerance.
Each axis rounds to the nearest quantum with ties toward positive infinity. A snapshot reports its linear tolerance.
A block key encodes sorted member IDs. A lane key encodes support and actual end node IDs.
A parcel key encodes its block and split path, starting with the canonical component ordinal.
A portal key encodes its parcel, lane and entrance role. Published records persist through growth.
Lane reserves extend into the incident block, with local joins at shared corners.
An undersized net component becomes open public ground.
Gross block area accounts for reserved lanes, court, passage, open ground and parcels.
The module draws no random numbers. The exhibition example uses six cells and two walkways.
