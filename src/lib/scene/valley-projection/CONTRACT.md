# Valley projection

`projectValley(valley)` projects the 2 km window to a detached object with ground and water mesh parts.
A 25 m terrain grid yields 12,800 ground triangles. Water fills the wet intersections of those same triangles.
The combined budget is 30,000 triangles. Contour heights are read from the ground in the stage material.
