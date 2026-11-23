# Parcels

`createParcelPlan` reads a fixed XY carrier, width reservations, ordered pair proposals
and a holding program supplied by the caller. Coordinates and widths are in meters.
Outer rings run counterclockwise and close implicitly. Hole rings run clockwise.
A block ID encodes the sorted member addresses. A lane ID encodes the support address
and its canonical pair of actual nodes. Neither key contains coordinates.
The same published block and lane records survive selection of additional whole blocks.
A protected lane cannot become a seam. A pair with disconnected or inaccessible net
ground is declined before publication. The module makes no random draws.

The six-cell exhibition example reserves space for two walkways.
