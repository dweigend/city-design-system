# House and court projection

`createHouseCourtContext(deck, house)` projects the exposed convex face rings and level plot into a shared stage context. The context supplies the bounds, opening orientation and perspective distance. The shared stage fits the frame. Roof, exterior walls and court walls use separate tonal steps from the stage palette. The stage owns disposal after attachment. Geometry and input snapshots stay detached.
