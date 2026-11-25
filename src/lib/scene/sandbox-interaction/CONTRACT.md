# Sandbox interaction contract

Interaction state of the sandbox lives here, never in the document: the stroke of one painting
pointer, the queue that builds objects off the input path, and the level of detail per house.

`createStrokeState` reads pointer inputs already resolved to the hosts they crossed. A press opens a
stroke; every host enters once, in path order, and is reported at once so the caller can preview
and apply it while the pointer moves. Release and a lost pointer keep the stroke; a cancel reverts
it. Other pointers are ignored while a stroke is open.

`createBuildQueue` runs pure jobs first in, first out, at least one per call and then until the
frame build budget (`buildBudgetMs`) has passed. Resubmitting an owner replaces its waiting job;
cancelling drops it and its products. Each owner keeps its latest two products by key, so switching back costs nothing, and while a new key waits the latest older product
stays readable. The same submissions build the same products in the same order. `showIntervalMs`
is the calm interval at which a busy queue's progress is shown.

`selectHouseDetail` passes the sandbox view to the shared house salience rule with the hovered
house as the subject in focus.
`shareBlockBudget` splits one block triangle budget evenly among a block's houses.
`readPreviewHeight` gives the stand-in body height at about the eaves (`previewEavesRatio`).

## Vertical preview

A press locks one fine cell and a vertical plane through its center. The plane faces
the displayed camera horizontally. The press ray and current ray bound the preview
interval in stage meters. Every intersected storey is returned once, in the direction
of travel from the press. Storeys include their bottom boundary and exclude their top
boundary. Targets come from the cell space, including available bands above occupied
ones. Only the two rays determine the span. Plan has no horizontal ray direction and
uses an explicit storey choice for the clicked cell.
