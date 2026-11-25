# Material contract

A family is a material of the model workshop (MAT-3): painted board, grey board (card), cork,
stripe laminate, perforated sheet, lit acrylic and an abstract ground. It lays one even face on a
planar patch and prints the marks of its pattern on it. Geometry carries the slots `face` and
`mark` in meters, never a colour. Use `paintClad` from `scene/surface` to assign colours; cork and
card grain is shading, not geometry.

- `buildSurface(family, patch, options?)` builds a patch from its origin, unit across axis, unit
  outward normal, size and backing thickness. The up axis is normal × across. Supply a convex
  outline for a gable and rectangular openings to cut. Openings cut their union within the outline.
  Set `backed: false` or use zero thickness for a single skin. For a bevel or a miter, supply a
  unit `backingDirection` with a positive component along the normal. Thickness is measured
  perpendicular to the face.
- Patterns are laid in the coordinates of a body box (`patch.pattern`, built by
  `createPatternFrame` from all faces of the body; default the patch's own box) and fitted to whole
  periods over the body. Stripes use the long axis on the roof and long walls and the other
  horizontal axis on the end walls. Each dark band sits at the center of its period, so both
  walls meet at a period boundary at every corner. The roof and long walls share the same bands
  along the eaves. Dot grids use the two body axes in the face (MAT-9). `createClad` builds the
  box for claddings that name the same `body`.
- Set `options.recipe` or a cladding's `recipe` to choose a pattern and override its pitch,
  printed share and joint spacing for that build. Omitted fields come from the named family.
  Painting uses the named family's palette, with graphite marks if the recipe adds a pattern to
  a plain family.
- Levels come from the level table in `config/material`: `near` (marks, openings, joint hairlines,
  grain), `mid` (marks, openings), `far` (plain face, only marks with a pitch of at least
  `farMarkPitchM`, no openings) and `pencil` (face, openings, joints as pencil lines). `relief` and
  `flat` are aliases of `near` and `far`. `readSurfaceLevel` from `scene/focus` maps display policy
  to these levels.
- The triangle budget is `patch.budget` or the configured density times patch area. Marks are
  preflighted against the budget and a work limit, coarsening the pattern pitch; if they never fit,
  the plain face is drawn. A budget below `minimumMeshTriangles` (12), or below the face alone,
  yields zero triangles, empty meshes and no lines.
- `createClad(input, claddings, options?)` takes a footprint, anchors and any plain parts with
  their declared slots. It combines meshes that share a role, family, tone, drawn level and family
  slot. The same inputs produce the same arrays. See `cladExample` in `example.ts` for a wall and a
  roof of one stripe body whose stripes meet at the eaves.

The [surfaces page](/surfaces) shows all seven families as plates and on a model house.
