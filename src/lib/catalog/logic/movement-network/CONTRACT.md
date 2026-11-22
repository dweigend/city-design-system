# Movement network

Kind: recipe
Purpose: Connects movement ports and finds deterministic routes through the resulting graph.
Exports: movementNetwork, composeMovementGraphs, findMovementPath
Outputs: A movement graph, ordered edge geometry and path queries.
Input: fragments | readonly MovementFragment[] | — | Ordered port and edge fragments | Required
Input: extraEdges | readonly MovementElement[] | — | Additional seam or crossing edges | Empty
Input: requests | readonly DockRequest[] | — | Pairs of existing port IDs | Empty

- **Purpose:** Single headless public entry for movement ports, edges, fragment composition (`composeMovementGraphs`), straight-line docking (`movementNetwork`), centreline extraction (`edgePath`), and deterministic path queries (`findMovementPath`).
- **Units & Frame:** World metres (`x, y` plan, `z` up), headings in radians CCW from `+x`, capacity in travellers/minute, grades dimensionless (`rise / run`).
- **Determinism:** Pure and RNG-free. Input order is preserved during assembly; `findMovementPath` breaks complete-route length ties within `1e-9` m of the exact shortest distance canonically by lexicographic edge-ID sequence.
- **Invariants:** Non-empty unique IDs; finite positive port width/headroom and edge capacity; purely vertical edges (`run = 0, length > 0`) throw `RangeError`; zero-length docks contribute `0` grade; an embedded nonzero vertical segment in a nonzero-run polyline yields `maxGrade = Infinity`. Incomplete stairs are pruned.
- **ST1 Mapping (conceptual):** `MovementPort` maps to ST1 `MovementPort` (`faceId` is currently absent from catalog ports and required by ST1); `MovementEdge.maxGrade` maps to ST1 `PathEdge.grade` on positive-run segments while `grade` stays signed mean rise/run; `minHeadroom` filters endpoint port metadata (`2.2 m` walking headroom is distinct from ST1's `3.7 m` spatial path reserve). An ST1 export also requires finite segment grades, `connectionId`, left-facing plan sample normals, and corridor coverage.
- **Example:**
  ```ts
  const graph = composeMovementGraphs([ground, bridge], [seam]);
  const route = findMovementPath(graph, fromId, toId, { modes: ['walk'], maxGrade: 0.08 });
  ```
