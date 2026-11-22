# Terrain grid

The terrain grid owns contour-following quad geometry and side incidence in world X/Y meters, with Z up.
Cell and vertex IDs are stable lattice addresses. Neighbor slots follow the counterclockwise corner order.
The current grid exposes both full derivation (`deriveGrid(terrain)`) and edit-local derivation (`regrid(grid, terrain)`).

`surveyGroundRoutes` connects destinations in a dry crop using the carrier's passage survey, grade and width profile.
It emits ordered arterial, street and alley centreline cells. Branches start on the existing route, and reserved cells are excluded.
`surveyEnclosedCourts` admits one plot enclosed by four old-town building plots per carrier block, with street frontage at the enclosure.
The city-plan module composes these surveys with districts and civic reserves.
