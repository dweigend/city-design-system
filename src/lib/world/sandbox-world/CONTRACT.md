# Sandbox world

The city adapter resolves parcel, portal, lane, crossing, bridge, graph-node, graph-edge, block,
plan-cell, plan-edge, plan-node and shore-node [world references](../../core/ref/CONTRACT.md). The
[document](../../domain/sandbox-document/CONTRACT.md) resolves the placement kind. The adapter's
placement host resolvers handle private parcels and ground movement edges. Asset offerings come
from those installed resolvers. A valid parcel with no room for a house keeps its address and
returns a garden reason.

The city plan namespace uses its address-generator revision, city seed, carrier family and
cell size, frame and terrain source identity. The topology revision hashes ordered address and
incidence data, including discrete column levels. Metric geometry belongs to the terrain or
placement inputs. The world copies the columns and their nested data when it opens the snapshot.
Saves from earlier topology hashes still replay using their world ID and host addresses. Supply a
revision for a custom sampler and a common custom terrain ID to keep the scope across its
revisions. Each separately editable world with otherwise identical inputs needs a distinct
scope. The default valley adapter identifies a generated plan, so copies of the same
generated plan share its namespace.

The placement cache attaches to one document. It stages each delta and rebuilds incoming
placements and any neighbors whose party-wall exposure changed.

## Survival

| Edit                                                                          | Reference outcome                                                                                            |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Geometry moves within the same incidence and ordering                         | Local topology keys and placement slots survive. The resolver returns the current geometry.                  |
| Growth adds addresses through a district threshold                            | Existing parcel, portal and lane interval addresses survive. A new tap can split an existing graph sub-edge. |
| Crossings reorder                                                             | Crossing keys and ground bridge keys survive.                                                                |
| A host disappears or is replaced by a split or merge                          | The former address resolves as `missing`. A saved placement becomes an orphan in its history.                |
| A ground point moves within its rounded XYZ grid slot                         | Its address survives. Motion to another slot addresses a different point.                                    |
| The plan family, seed, cell size, frame or address-generator revision changes | References resolve as `different-world`.                                                                     |
| Undo or redo                                                                  | A placement reference resolves when its slot is usable and occupied at the new history position.             |

Snapshots match surviving addresses by kind and key. Callers that allow an address to be reused
for a different feature must change the scope or supply a new local key. Comparing two detached
snapshots cannot detect intermediate disappearance and recreation. Terrain edit lineage remains
a separate contract.

## Local addresses

`JSON(…)` means a JSON array serialized without whitespace. Coordinates are in world meters, XY
horizontal and Z up. Integer lattice levels are relative to the city datum. Ground slot indices
are relative to world XYZ zero and round each axis to the nearest configured millimetre, with ties
toward positive infinity. A bare ID only has meaning within its owning topology.

| Address       | Current local key                                                                                                                                                                                                                 |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan cell     | `cell/i,j/part` for regular carriers, `sector/ring/sector` for polar, `site/i,j` for Voronoi, or `face/<sorted base-node ids>/split/<corner>` for organic and free quad                                                           |
| Plan node     | `node/i,j`, `center` or `radial/ring/sector`, `bisector/JSON(sorted generating sites)`, or organic `base/i,j`, `edge/<plan edge>`, `face/<sorted base-node ids>/center`. A collapsed Voronoi cluster takes its lowest member key. |
| Plan edge     | Sorted endpoint pair joined by a pipe. If either ID contains a pipe, two leading pipes followed by the JSON pair.                                                                                                                 |
| Shore node    | `shore/JSON(sorted plan-edge endpoints)`. A clip returning the original land node uses its plan-node ID.                                                                                                                          |
| District      | `district/<earliest ranked member>` for a connected district and `<density kind>/<earliest ranked member>` for a density region                                                                                                   |
| Bay           | `<plan cell>/level/<level>`                                                                                                                                                                                                       |
| Face          | `cap/<bay>` at a level plane, `side/<plan edge>/level/<level>` for a coarse side. Child faces use the JSON array of sorted logical point IDs.                                                                                     |
| Child bay     | `<bay>/child/JSON(corner, half)`                                                                                                                                                                                                  |
| Fine cell     | `<URI-escaped parcel>[/ear/JSON(corner keys)]/child/JSON(corner)` plus one `/child/JSON(role)` per refinement                                                                                                                     |
| Strip         | `<URI-escaped parcel>[/part/<part>]/strip/JSON(column, row)`. The column parent omits the row. A convex part that stays whole uses its part key.                                                                                  |
| Storey        | `<fine cell>/storey/<zero-based index>`                                                                                                                                                                                           |
| Block         | JSON array of sorted plan cell IDs                                                                                                                                                                                                |
| Parcel        | `JSON(block, split path)`, with component ordinal followed by binary cut choices                                                                                                                                                  |
| Parcel corner | `corner/JSON(portal, corner count, CCW offset from the supporting side)`                                                                                                                                                          |
| Lane interval | `JSON(support, endpoint pair)`, with a plan edge or `JSON("shore", cell)` as support                                                                                                                                              |
| Portal        | `JSON(parcel, lane, "frontage")` or `JSON(block, lane, "court")` for a public court entrance                                                                                                                                      |
| Crossing      | JSON array of ordered plan path nodes, starting at the lower bank-node key                                                                                                                                                        |
| Graph node    | `ground/<plan node>`, `lane-tap/JSON(lane, sorted incident portals)`, the entrance's portal key, `level/<level>/<ground node>`, or `station/<station>`                                                                            |
| Graph edge    | `lane/JSON(lane, from node, to node)`, `access/<portal>`, `bridge/<crossing>`, `walkway/<plan edge>`, `upper/<bridge>`, `stair/<plan node>`, or `dock`, `dock-stair` or `station-stair` followed by `/<station>`                  |
| Joint         | `vertex/<plan node>/level/<level>`, `cell/<plan cell>/level/<level>` or `edge/<plan edge>/level/<level>`                                                                                                                          |
| Member        | JSON array of sorted joint IDs                                                                                                                                                                                                    |
| Asset         | Registry-defined slash-separated lowercase kebab-case segments                                                                                                                                                                    |
| Host          | Host kind and its local key, with `JSON(x index, y index, z index)` for ground                                                                                                                                                    |
| Placement     | `JSON(world, host kind, host key)` for the document's one slot per host                                                                                                                                                           |
