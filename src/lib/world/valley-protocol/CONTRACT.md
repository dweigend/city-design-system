# Valley protocol

The scalar fixtures preserve the four measured river references, the 38 preregistered seeds and the frozen acceptance bounds.
The protocol clips centerlines to 2 km and 8 km squares with two border contacts each, and measures north-first cross sections on a 12.5 m raster.
It measures the routed centerline at its native vertices. The first land slope class counts samples below the smallest slope threshold.
The 38-seed gate checks wet width, sinuosity order and ranges, core relief, land slope, terrace steps and floodplain form.
Cologne's bare-earth reference provides the ground measurements. Bonn, Basel and Regensburg supply river geometry.
The picture list fixes three seeds for checking centerline placement, band continuity and mask differences in a shared downstream frame.
The X1 matrix includes those three and three more fixed examples. The holdout matrix takes 32 seeds from the sequence rooted at `VALLEY_HOLDOUT_ROOT` and measures them independently of the picture selection.
The public sinuosity series checks monotonic mean regional sinuosity across all 38 seeds.
