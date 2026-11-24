# City site

Composes a terrain source and a seeded plan carrier. The default valley and alternate
samplers use world XY meters, Z up, and radians for the bearing.

- `createCitySite` uses the configured valley or an alternate sampler. The sampler returns
  height and signed clearance from water. A wet reading gives the water kind and surface
  height. A null kind means dry ground. Planning, overlays and studies read the same site.
- The city carrier uses the terrain grid's sampled elevation range mode. It admits dry
  ground beyond the bank setback up to the range in `citySiteConfig.maximumCellRiseM`.
  The terrain grid's default interval grade applies to callers without a cell-wide limit.
- Growth takes a prefix of the same ranked carrier as size increases. The layout returns
  `growth.rankedCellIds` and `growth.futureFringe` as plain data alongside the buildable
  grid. Pass that layout to `readCityDistricts` after copying, storing or reselecting the grid.
- The grid retains canonical terrain vertices. The fixed datum anchors the shared
  lattice planes for any growth step.

The example reads the opening town for seed 1201 and uses its growth data to derive districts.

`readCityParcels` reads the fixed holding program at the selected growth prefix.
Parcel and block addresses belong to the plan. Use a block's `memberCellIds` to resolve its
original cells and canonical bays. `readCityDistricts` gives the current density of those cells.
A crossing's ID encodes its addressed path, independent of which of its head cells are active.
