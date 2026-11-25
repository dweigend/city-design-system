# Story valley

`createStoryValley` follows one seeded river reach through four events (CITY-11, GROW-1,
GROW-4). The city carrier supplies the dry plan cells and the permanent vertical datum.
Geometry is in world XYZ meters. Buildings occupy compact holdings around the bridgeheads.
The first settlement starts on one bank. The dated footbridge opens the other bank, then
the vacant holdings nearest either bridgehead fill in. Equal distances keep carrier order.

A building keeps its plan-cell anchor and construction year throughout the sequence (CITY-3,
GROW-2). Each plinth and storey keeps its geometry, construction year and datum-indexed ID
(GROW-3). A snapshot excludes future parts and marks parts built in its own year as additions.
The riverside hall keeps its original lower storey and gains three upper storeys at handover.
The precedent adoption identifies the original storey and the first new one.
Within one call the snapshots share part geometry. Treat the records as read-only.
Each call builds a detached history.

The footbridge uses the city carrier's addressed crossing and preserves its bank node IDs
(GRID-3). Its deck and bearing parts arrive together in 1985. The intervention leaves the
terrain sampler and the addresses of the existing buildings intact. Camera framing, graphite
stock and use color belong to the chapter projection (COLOR-5, UI-3).
