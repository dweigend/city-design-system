# Geometry Principles

**Ten principles carry both the design language and the engine.** Sections 2–6 name the five fields of geometry they rest on: P, Q, E, D, G.

## 1 Scope

Grid-independent means: one contract works on different decompositions. Doors, walking times and loads keep physical dimensions.

## 2 Parcels and layout (P)

Persistent parcel relations, straight skeleton, split grammars, program before floor plan.

## 3 Fields and quad meshes (Q)

Direction and tensor fields, quadrangulation, midpoint subdivision, bounded relaxation.

## 4 Corner modules and synthesis (E)

Corner values to surfaces, dual contouring, model synthesis, wave function collapse.

## 5 Dynamic layouts and networks (D)

Incremental path search, sparse networks, space syntax, proximity as game quality.

## 6 Robustness and deformation (G)

Exact sign decisions, mean value and harmonic coordinates, quality measures as contract.

## 7 World rules

1. A block is a macrocell; an alley is its edge.
2. The world reads only the graph. A block corner is a bend above 28°.
3. Rules measure in meters: span 13 m, flight run 2.6–10 m for 4 m rise.
4. Degeneration is a rule: a block with fewer than five build cells stays a plaza.
5. Walkways are occupancy on the same graph.
6. Mesh work is cached; sliders reuse it.
7. The scene only projects.

## 8 Universal principles

| ID  | Principle                                       | Statement                                                               | Evidence |
| --- | ----------------------------------------------- | ----------------------------------------------------------------------- | -------- |
| U1  | Relationships before embedding                  | First what is connected, then where it appears.                         | P, D     |
| U2  | Duality of region and transition                | Cell and transition are two views of one incidence structure.           | Q, E     |
| U3  | Local rules with global checking                | Compatible parts build form; access is checked in addition.             | E, P, D  |
| U4  | Fields guide alignment and density              | One tendency steers many elements, whatever their polygon count.        | Q, P     |
| U5  | Hierarchy with provenance                       | Subdivision keeps the identity of its source region.                    | P, Q     |
| U6  | Form family and admissible deformation          | Identity lies in relations and bounded proportions, not rigid copies.   | P, G, Q  |
| U7  | Validity is an invariant                        | Every accepted operation keeps topology, clearance, access, protection. | G, Q, D  |
| U8  | Change follows dependencies                     | An edit changes its provable consequences; the rest stays.              | P, D, E  |
| U9  | Reachability and cycles connect scales          | A function belongs to the city once usable links reach it.              | D, P     |
| U10 | Separate intent, interpretation, representation | Views explain the state; they never define it.                          | P, E, D  |

Every principle has a player side and an engine side. Example U7: existing stock stays in place for the player; the engine runs `propose → validate → commit`.
