# City plan

`planCity` extends a surveyed valley town from two rail stops. `deriveGroundPlan` composes the terrain-grid circulation and court surveys with seeded districts.
`deriveGroundPlan(grid, '76/64', 104)` on terrain seed 7 returns the dry connected crop, district centres, ordered routes and a disjoint cover of stable areas.
The plan seed must be an unsigned 32-bit integer. An unknown, raised or open anchor raises RangeError.
Cell coordinates reference the source snapshot in world X/Y meters with Z up. Boundary rings are detached XY, positive for exteriors and negative for holes.
`ground-plan/2` uses named hash draws for district rotation and lobe dimensions, style weights, the common old-town eave, pocket gaps, detached setbacks and tower count.
Cells emit in carrier order, route ties use discovery order, and memberships sort by cell ID.
IDs are namespaced by terrain seed, anchor and plan seed. The arterial, network and plaza have fixed role keys. Branches key by destination, courts by carrier block and plots or gaps by cell.
Path areas carry ST1 clearance in meters. The other reserves are open to the sky. An ST1 adapter supplies convex CCW pieces and a base elevation per piece.
