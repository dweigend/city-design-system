# Cell space

`createCellSpace({ nodes, faces, cells })` takes addressed nodes in world metres (XY ground, +Z up), planar face rings and cell shells. Producers supply simple polygons, non-overlapping cells and conforming face contacts. A shared contact uses a single face ID and node ring.

The detached result lists nodes, faces and cells in lexical ID order. Each face has one exterior use or two opposite uses in cell ID order. A use with direction `1` follows the stored ring. A use with direction `-1` reverses it. A shared edge or vertex alone has zero contact area.

The constructor validates finite nodes, face rings, references, connected edge-manifold shells, incidence and positive volume. It computes volume in m³ from each oriented shell. Length and volume tolerances use the local span in metres with a 1 m floor, scaled by 1e-9 and 1e-8 respectively. Invalid input throws `RangeError`. See the conforming deck in the house-court test.
