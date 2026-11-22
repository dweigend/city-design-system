# Movement Network Contract

- **Purpose:** Single headless public entry for movement ports, edges, fragment composition (`composeMovementGraphs`), straight-line docking (`movementNetwork`), centreline extraction (`edgePath`), and deterministic path queries (`findMovementPath`).
- **Units & Frame:** World metres (`x, y` plan, `z` up), headings in radians CCW from `+x`, capacity in travellers/minute, grades dimensionless (`rise / run`).
- **Determinism:** Pure and RNG-free. Input order is preserved during assembly; `findMovementPath` breaks length ties within `1e-9` m canonically by lexicographic edge-ID sequence.
- **Invariants:** Non-empty unique IDs; finite positive port width/headroom and edge capacity; purely vertical edges (`run = 0, length > 0`) throw `RangeError`; zero-length docks contribute `0` grade; an embedded nonzero vertical segment in a nonzero-run polyline yields `maxGrade = Infinity`. Incomplete stairs are pruned.
- **ST1 Mapping:** `MovementPort` maps to ST1 `MovementPort` (future `faceId` optional); `MovementEdge.maxGrade` maps to ST1 `PathEdge.grade` while `grade` stays signed mean rise/run; `minHeadroom` filters endpoint port metadata (`2.2 m` walking headroom is distinct from ST1's `3.7 m` spatial path reserve).
- **Example:**
  ```ts
  const graph = composeMovementGraphs([ground, bridge], [seam]);
  const route = findMovementPath(graph, fromId, toId, { modes: ['walk'], maxGrade: 0.08 });
  ```
