# City volume projection

Projects city envelopes and lattice joints into the metric terrain frame. Envelope roofs
and lattice tops read the same world elevations from the city volume.

- Auto applies one vertical factor to ground, water and architecture about Z = 0.
  The landscape relief scale caps this factor and it returns to 1 at quarter zoom.
- True scale keeps world elevations at every zoom.
- Height view colours nominal column heights on the same opaque metre scale.

The camera lowers with the metric frame width so the true-scale quarter reads in elevation.

The example projects a fixed valley city and its box lattice.
