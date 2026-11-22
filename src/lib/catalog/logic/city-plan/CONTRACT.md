# City plan

`planCity` extends a surveyed valley town from two rail stops. Import `deriveGroundPlan(grid, anchorId, seed): GroundPlan` from the city-plan index.
`deriveGroundPlan(grid, '76/64', 104)` on terrain seed 7 returns the dry connected crop and its disjoint cover of stable areas.
The seeded plan owns paths, courts and plots within its crop. The carrier supplies geometry, blocks and passage survey inputs. The stage masks carrier alley ink in the crop. Seeded house consumers use plan plots.
Compare seeds on one grid and anchor using the detached boundary rings, district centres and ordered routes, beginning with the arterial.
The plan seed must be an unsigned 32-bit integer. An unknown, raised or open anchor raises RangeError.
Cell coordinates reference the source snapshot in world X/Y meters with Z up. Boundary rings are detached XY, positive for exteriors and negative for holes.
`ground-plan/2` uses named hash draws for district rotation and lobe dimensions, style weights, the common old-town eave, pocket gaps, detached setbacks and tower count.
Cells emit in carrier order, route ties use discovery order, and memberships sort by cell ID.
IDs are namespaced by terrain seed, anchor and plan seed. The arterial, network and plaza have fixed role keys. Branches key by destination, courts by carrier block and plots or gaps by cell.
Each plot has one `parcel` and one `block`. A parcel groups side-connected plots of the same kind within a carrier parcel and block. IDs use the plan namespace and the lexically first ground cell address in the parcel or the carrier block address, respectively.
Path areas carry ST1 clearance in meters. Courts, the plaza and gaps are open to the sky. Reserved cells have no plot.
The detached `plan.reservations` map indexes ground cell IDs by area owner. The volume producer selects protected leaves from each area's scope, including only below-clearance leaves for paths and the full column for open-to-sky areas.
Call `projectGroundReservations(plan, space, groundByLeaf)` with protected leaf IDs mapped to their reserved ground IDs. Pass the resulting detached `Reservations` map to `occupyCells`. The projection preserves owner IDs, sorts by leaf ID and throws `RangeError` for unknown leaves or unreserved sources.
