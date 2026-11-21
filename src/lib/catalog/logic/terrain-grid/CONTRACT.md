# Terrain grid

The terrain grid owns contour-following quad geometry and side incidence in world X/Y meters, with Z up.
Cell and vertex IDs are stable lattice addresses. Neighbor slots follow the counterclockwise corner order.
The current grid exposes both full derivation (`deriveGrid(terrain)`) and edit-local derivation (`regrid(grid, terrain)`).

The internal ground plan keeps the dry, side-connected crop around an anchor cell and partitions it into buildable ground, paths, plazas and courts.
Area IDs use the version, terrain and plan seeds, anchor, use, and lowest member cell ID. Shared geometry remains in the grid snapshot.
`ground-plan/1` uses counter-based draws: lobe parameters by lobe key (channels 0–3), path cadence and plaza quadrant by plan seed (4–7).
Cells and area emission follow carrier index. Path searches visit neighbors in side order. Area membership is ordered by cell ID.
For example, on the seed-7 terrain, a plan anchored at `76/64` can be derived with plan seed 104.
