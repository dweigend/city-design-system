# Sandbox interaction contract

Interaction state of the sandbox lives here, never in the document: the stroke of one painting
pointer, the queue that builds objects off the input path, and the level of detail per house.

`createStrokeState` reads pointer inputs already resolved to the hosts they crossed. A press opens a
stroke; every host enters once, in path order, and is reported at once so the caller can preview
and apply it while the pointer moves. Release and a lost pointer keep the stroke; a cancel reverts
it. Other pointers are ignored while a stroke is open.

`createBuildQueue` runs pure jobs first in, first out, at least one per call and then until the
frame build budget (`buildBudgetMs`) has passed. Resubmitting an owner replaces its waiting job;
cancelling drops it and its products. Each owner keeps its latest two products by key (one per
display level), so switching back costs nothing, and while a new key waits the latest older product
stays readable. The same submissions build the same products in the same order. `showIntervalMs`
is the calm interval at which a busy queue's progress is shown.

`selectHouseDetail` is a thin policy: every house is a plain volume; the hovered house shows flat
cladding and the selected house relief. A salience rule can replace it behind the same output.
`shareBlockBudget` splits one block triangle budget evenly among a block's houses.
`readPreviewHeight` gives the stand-in body height at about the eaves (`previewEavesRatio`).
