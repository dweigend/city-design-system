# Parcel deck

Kind: recipe
Purpose: Fits an addressed 3 × 3 carrier deck to a level parcel.
Exports: createParcelDeck
Outputs: Detached deck geometry, plot outline, exterior court exit face and ordered slot bindings.
Input: plot | LevelParcel | m | Level rectangular parcel | Required
Input: seed | number | — | Carrier seed | 7
Shared inputs: height, width, complexity

`createParcelDeck(plot, inputs?, seed?)` takes a level rectangle in world metres. Supply its oriented entrance edge and depth. The interior lies to the left of the directed edge. The adapter fits one centred orthogonal 3×3 carrier deck and preserves its addresses under parcel-local changes of dimensions. The rear reaches the requested height. The entrance reaches height × (1 − complexity / 2).

Parameters default to the block input schema and the source carrier seed defaults to 7. An invalid plot or width exceeding its smaller dimension throws `RangeError`. A failed carrier contract throws `Error`. The result owns its resolved block inputs, detached geometry, plot outline, exterior court exit face and slot bindings in entrance-to-rear, left-to-right order.
