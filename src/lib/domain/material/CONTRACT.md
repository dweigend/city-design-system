# Material contract

A family lays units, joints and trim on a planar patch and raises them as relief. Geometry carries
family slots in meters. Use `paintClad` from `scene/surface` to assign colors.

- `buildSurface(family, patch, options?)` builds a patch from its origin, unit across axis, unit
  outward normal, size and backing thickness. The up axis is normal × across. Supply a convex
  outline for a gable and rectangular openings to cut through both relief and backing.
- Pass the direction the light travels in world axes as `options.light`. Pass external shadows
  as convex, counter-clockwise polygons already projected into the patch's coordinates.
  `surfaceLight` from `scene/stage` supplies the stage direction.
- `relief` raises units, `flat` builds a single slab and `pencil` adds joint strokes to that slab.
  `readSurfaceLevel` from `scene/focus` maps display policy to these levels.
- The triangle budget is `patch.budget` or the configured density times patch area. Relief and
  pencil preflight their layouts against the budget and a work limit, coarsening the module as
  needed. If detail still exceeds either limit, the recipe tries a flat slab.
  A budget below `minimumMeshTriangles` (12), or below the required slab cost when falling back,
  yields zero triangles, empty meshes and no strokes.
- `createClad(input, claddings, options?)` takes a footprint, anchors and any plain parts with
  their declared slots. It combines meshes that share a role, family, drawn level and family
  slot. The same inputs produce the same arrays. See `cladExample` in `example.ts` for two wall
  faces sharing a role at a corner, with an opening in one face.

The [surfaces page](/surfaces) shows all six families as plates and on a gabled body.
