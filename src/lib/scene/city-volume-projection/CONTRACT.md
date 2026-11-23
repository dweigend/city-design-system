# City volume projection

Projects city envelopes and lattice joints into the metric terrain frame. Envelope roofs
and lattice tops read the same world elevations from the city volume.

- Auto applies one vertical factor to ground, water and architecture about Z = 0.
  The landscape relief scale caps this factor and it returns to 1 at quarter zoom.
- True scale keeps world elevations at every zoom.
- Height view colours nominal column heights on the same opaque metre scale.

The camera lowers with the metric frame width so the true-scale quarter reads in elevation.

The example projects a fixed valley city and its box lattice.

A focus choice sets the display level of terrain, water, each district kind and the lattice
(`scene/focus`). Full kinds show the shaded envelope in their blueprint step. Stock out of focus
becomes one plain box per column, inset by a street, a seeded sixth of them drawn in pencil;
a visible lattice keeps the envelope instead, as a calm veil with the stepped silhouette as its
strongest line. Boxes and envelope cast flat two-band ground shade. Every level reuses the same
geometry. The taper field moves envelope and lattice by `Taper × detail fade`, so it is zero at
quarter zoom and complete once member detail is gone.
