# Form Language

**Existing stock is pencil, the new is a white model, color shows life.** Forms and grids are exchangeable; the visual grammar is fixed.

## 1 Three levels

Grid → composition → form. A form family fills any cell shape from footprint, orientation and height.

## 2 Form families

Twelve families: klotz (block), zylinder, kapsel, bogen (arch), rahmen (frame), ring, rohr (pipe), kopf (crown), huelle (skin), erschliessung (access), vegetation, bestand (existing stock).

## 3 Modules: corner masks and material steps ("Materialstufen")

Eight binary corners give 256 masks. Four rotations about the vertical axis leave 70 classes: (256 + 16 + 4 + 4) / 4. Tilting is excluded: a roof must not become a wall. Modules deform bilinearly in plan and linearly in height.

Material steps are the four levels of representation: Detail, Medium, Block, Envelope.

## 4 Composition rules

Plinth–stack–crown, core with cantilevers, frame with plug-ins, platform stack, rooftop extension, courtyard, network, landmark. Tower rule: stock carries, frame sets bays, colored plug-ins show function, stairs run outside, a crown sits on top.

## 5 Structural families

Folded plate (Miura), geodesic dome, honeycomb, space frame, gridshell. Families differ by geometry, never by color. A family switch is a discrete rebuild, never a morph.

## 6 Scale

| Element                          | Value                |
| -------------------------------- | -------------------- |
| Figure                           | 1.8 m                |
| Storey, stock / new              | 4 m / 3.5 m          |
| Elevated-walkway level           | 8 m                  |
| Strut, primary / secondary / rib | 0.18 / 0.10 / 0.14 m |
| Dome radius; gridshell span      | 9–15 m; 20–32 m      |

## 7 Visual grammar

- Structure is the darkest value. Stroke weight is the computed diameter, at least 1.5 px.
- The envelope is model white. Flow color sits only on rooms, paths and green.
- At most three flows per image; at least 60 % stays neutral.
- One orthographic projection: azimuth 32°, elevation 26°. Scales 1:50, 1:200, 1:500, 1:2000.
- Signal outlines the selection; it never fills.

## 8 References

The stance draws on Bauhaus, Memphis, Archigram (_Plug-in City_), Metabolism, Frei Otto, Buckminster Fuller and Oskar Stålberg's _Townscaper_. No building or silhouette is copied.

## 9 Corner modules on the contract

Two projections share one topology. The build view holds dual build cells; occupancy is a separate table. The module view holds quad slots with eight corner samples. A mask (0–255) is not a field (0–1). The corner module adds to form families; it does not replace them.

## 10 Corner modules in use

Three typical scenes: a shared envelope, an elevated walkway at existing stock, and U → courtyard → U. One click changes several slots; undo restores the state.
