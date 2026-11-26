# Paths projection

Projects movement edges and transit bearings as role-slot geometry in a caller-owned frame.
Ground reservations may come from the parcel projection. Any route still reads the shared centerline.
The Paths focus preset can hide path and rail layers without rebuilding their meshes.
The example shows walking geometry alongside a fixed rail survey.

## Elevated enclosures and services

Both projections read a caller-sampled centerline in local XYZ meters and
accept optional endpoint roll and joint indices. They return a placeable
object with two outward, oriented end anchors and a fresh drawable list.
The caller supplies grades, connections, and clearances.

- `projectWalkableTube` draws a thin elevated deck inside an open-ended glazed
  shell. Pink deck and ribs stay opaque in every view (CITY-2, CITY-5, COLOR-3).
  Ribs repeat by distance along the run, with collars at ends and specified
  joints (FORM-5).
- `projectServicePipe` draws a narrow conduit and sleeves with the selected
  water, energy, or material color (COLOR-2, FORM-5). `paintServicePipe` changes
  visibility for the normal and transparency displays using the same meshes
  (COLOR-8).

The geometry carries slots. Surface finishes and tokens are assigned here
(MAT-1).
