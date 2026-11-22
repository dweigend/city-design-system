# Terrain grid

Kind: recipe
Purpose: Builds a contour-following terrain grid with stable quad addresses.
Exports: deriveGrid, regrid, surveyGroundRoutes
Outputs: Grid geometry and side incidence, with ordered ground routes available through the survey.
Input: terrain | Terrain | m | Terrain snapshot | Required
Input: grid | TerrainGrid | m | Previous snapshot for regrid | Required for regrid

The terrain grid owns contour-following quad geometry and side incidence in world X/Y meters, with Z up.
Cell and vertex IDs are stable lattice addresses. Neighbor slots follow the counterclockwise corner order.
The current grid exposes both full derivation (`deriveGrid(terrain)`) and edit-local derivation (`regrid(grid, terrain)`).

In a `deriveGroundPlan` crop, city-plan owns the active paths, courts and plots. Carrier alley and court classifications apply to the surveyed town outside that crop.
`surveyGroundRoutes` uses the carrier's passage survey, grade and width profile as inputs to city-plan routing. It connects destinations in a dry crop and excludes reserved cells.
It emits ordered arterial, street and alley centreline cells. Branches start on the existing route.
