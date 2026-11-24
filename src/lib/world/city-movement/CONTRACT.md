# City movement

The city adapter composes parcel lane intervals, selected crossings, elevated walkways and rail docks.
Plan vertices retain `ground/<plan-vertex>` addresses. `portalNodeIds` maps parcel entrances to graph nodes.
Each lane edge keeps its reserved width in meters, hierarchy and walking surface.
Main lanes and promenades cost less per meter. Stair costs take precedence over hierarchy.
Stairs and walkway bearings require dry ground outside parcel interiors, alongside column clearance.
All routes use the shared movement query and its deterministic tie order.
The example uses the first crossing in the fixed-seed city with two station catchments.
