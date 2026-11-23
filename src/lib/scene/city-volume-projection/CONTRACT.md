# City volume projection

Projects city envelopes and lattice joints into the metric terrain frame. Envelope roofs
and lattice tops read the same world elevations from the city volume.

- Auto applies one vertical factor to ground, water and architecture about Z = 0.
  The landscape relief scale caps this factor and it returns to 1 at quarter zoom.
- True scale keeps world elevations at every zoom.
- Height view colours nominal column heights on the same opaque metre scale.

The camera lowers with the metric frame width so the true-scale quarter reads in elevation.

The example projects a fixed valley city and its box lattice.

A focus choice sets the display level of terrain, water, the plan grid, its water cells, the
selected crossings, each district kind and the lattice (`scene/focus`); the Plan step is the Plan
focus. Full kinds show the shaded envelope in their district step with light roofs, deep walls,
dark hairline edges, level lines and cell joints. Stock out of focus becomes one plain box per
column, inset by a street, a seeded sixth of them drawn in pencil, with its roof ring, wall
corners and ground line as separate strokes; a visible lattice keeps the envelope instead, as a
calm veil with the stepped silhouette as its strongest line. Lattice members rank by direction:
level chords, plumb uprights and each model's own slants. Roofs and walls are wound to face up
and out. Boxes and envelope cast flat two-band ground shade. Every level reuses the same
geometry, and one viewport yields one list. The taper field moves envelope and lattice by
`Taper × detail fade × width fade`, so it is zero at quarter zoom on any canvas and complete once
member detail is gone. Every tunable number lives in `constants.ts`.
