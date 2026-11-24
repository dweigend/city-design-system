# House projection

The projection draws the house object's role slots with the stage's display levels.
The clad projection places the object and its planar face patches together, allocates relief
triangles by patch area and paints each patch through its role's material family. Patches
and placement translations use meters and rotations use radians. The optional seed selects
repeatable surface variants. See the fixed specimen in `example.ts`.
