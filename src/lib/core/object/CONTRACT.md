# Placeable objects

An anchor specifies a position in meters and a unit outward normal. An optional unit
`transverse` specifies roll and completes the right-handed frame
`(normal, transverse, normal × transverse)`. Creation checks the vector length and the
absolute dot product against the anchor unit-vector tolerance, copies the tuple, and freezes
it with the object. Omitting `transverse` keeps the original anchor shape.

`move` rotates both directions about world Z and applies translation only to the anchor
position. It returns another detached, validated, deeply frozen object.
