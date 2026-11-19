# Naming Conventions

Owner for: language, glossary, casing, verbs, units in names, type roles, names of variants and sources. One concept carries the same name everywhere: in API, code, tests, UI, Bible, and docs (NC Intro · N).

## Language

| ID    | Rule                                                                                                                                                                                                                                   | Source · Auth.               |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| NC-01 | **Decided by David on 2026-11-16.** All text, comments, documentation, and website content use English. Identifiers, filenames, folders, and routes remain unchanged. The glossary defines English domain terminology.                 | David, 2026-11-16 · D        |
| NC-02 | New operations and technical roles are named in English according to the [verb table](#operations). Domain nouns follow the glossary. Until a decision is reached, an existing term in a module continues to apply within that module. | NC §Operations; Transfer · V |
| NC-03 | Commit subjects are in English ([GW-21](../development/git-workflow.md#commits)).                                                                                                                                                      | NC §Language; GW · N         |
| NC-04 | An established domain term beats an abbreviation and a generic infrastructure name. Scientific terms and algorithm names remain intact.                                                                                                | NC §Language · N             |
| NC-05 | Parts of the system do not receive proper names. A part is named after what it is or does.                                                                                                                                             | NC §Language · N             |

## Glossary

The full English–German terminology table lives in [GLOSSARY.md](GLOSSARY.md). The glossary grows along with the codebase; a new domain term is entered here before appearing across multiple modules.

| Term                         | Code Identifier         | Meaning and Distinction                                                         |
| ---------------------------- | ----------------------- | ------------------------------------------------------------------------------- |
| intent                       | `Intent`                | Authoritative input of a generator. Data only, no callbacks.                    |
| build cell                   | `Vertex`                | Carrier vertex. Occupancy sits on build cells.                                  |
| occupancy, sample            | `Sample`                | Build cell × level. Do not confuse with the verb `sample` (random draw).        |
| existing, new                | `'bestand'`, `'neu'`    | Roles of a building component.                                                  |
| design bible, lab, workbench | —                       | Product sections of the website. Lab is not a throwaway experiment.             |
| block, macro cell            | `blocks`                | Buildable region. Its edge is the alley.                                        |
| level of representation      | `LevelId`               | `detail`, `mid`, `block`, `hull`. Do not confuse with `level` (elevation step). |
| level                        | `level`                 | Discrete elevation index, not height in meters.                                 |
| corner module, corner mask   | —                       | Module on the dual grid; mask of corner occupancies.                            |
| embedding, position layer    | `positions`             | Positions attached to a topology.                                               |
| alley                        | `alleys`                | Public in-between space. The city has no streets.                               |
| floor                        | `floors`                | Architectural story of a building volume.                                       |
| provenance, origin           | `origins`, `Derivation` | Rule path from which an ID originates.                                          |
| elevated walkway             | —                       | Walkable connection above alley level.                                          |
| metric                       | —                       | Measured value with unit.                                                       |
| parcel                       | `Parcel`                | Lot. Not the same as a quad face/slot.                                          |
| square (place)               | `squares`               | Open public space. Do not confuse with the `square` grid.                       |
| grid                         | `Grid`, `raster/`       | Generator of a cellular decomposition.                                          |
| seed                         | `seed`                  | Initial value of randomness. Not a continuation state.                          |
| fringe                       | —                       | Cyclic perimeter of a block.                                                    |
| flow                         | `FlowId`, `flowToken`   | People, Water, Energy, Food, Material cycle.                                    |
| carrier                      | —                       | Topology on which grids sit as position layers.                                 |
| quad, face                   | `Face`                  | Face of the carrier; slot for a module.                                         |
| world                        | `welt/`                 | Composed city scene. Not the library's `World` (membership and tick).           |

Grid types are named in code by behavior, and in prose per the glossary: `square` checkerboard, `axis` axial grid, `triangle` triangle, `hex` hexagon, `polar` polar, `contour` contour grid, `voronoi` Voronoi, `quad-irregular` irregular quad grid, `organic` free organic, `vertical` vertical.

## Spelling and Casing

| ID    | Element                                      | Convention                                           | Source · Auth.       |
| ----- | -------------------------------------------- | ---------------------------------------------------- | -------------------- |
| NC-10 | Variables, properties, parameters, functions | `camelCase`                                          | NC §Spelling · N     |
| NC-11 | Types, classes, component symbols            | `PascalCase`                                         | NC §Spelling · N     |
| NC-12 | Svelte component files                       | `PascalCase.svelte`                                  | NC §Spelling · N     |
| NC-13 | New modules and folders                      | `kebab-case`, named by capability or responsibility  | NC §Spelling · N     |
| NC-14 | Runtime tests                                | capability plus `.test.ts`, next to the module       | NC §Spelling · N\*   |
| NC-15 | Stable string discriminants and error codes  | lowercase `kebab-case`, e.g. `quality-unattainable`  | NC §Spelling · N     |
| NC-16 | CSS classes and custom properties            | `kebab-case` with semantic meaning                   | NC §Spelling · N     |
| NC-17 | Route folders                                | lowercase, one word or `kebab-case`                  | Current practice · V |
| NC-18 | Module constants                             | `UPPER_SNAKE_CASE` allowed; local values `camelCase` | NC §Spelling · N     |
| NC-19 | Abbreviations in names                       | `Id`, `Url`, `Xml`; `UI` stays uppercase             | NC §Spelling · N     |

Existing names are not renamed solely to switch between allowed casings. No names like `new`, `next`, `old`, `legacy` and no opaque phase codes. A lab number paired with capability (`L10Corners`) is allowed; a bare number is not (NC §Spelling · N\*).

## Objects, Collections, Identity

| ID    | Rule                                                                                                                                             | Source · Auth.  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| NC-20 | Singular for one object, plural for the collection. Count: `<singular>Count`. No `num*`.                                                         | NC §Objects · N |
| NC-21 | Positive booleans and predicates: `isClosed`, `hasAccess`, `canSplit`. No negative flags.                                                        | NC §Objects · N |
| NC-22 | Identity, index, and label are different things with different names. `id` on the unambiguous owner, otherwise qualified: `vertexId`, `blockId`. | NC §Objects · N |
| NC-23 | Lookup tables are named after their relationship: `cellsById`, `blockOf`.                                                                        | NC §Objects · N |

## Units and Values

| ID    | Rule                                                                                                                                                                                                                         | Source · Auth.                        |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| NC-30 | In `logic/`, meters and radians are the base units and need no suffix ([PE-1](PROCEDURAL_PRINCIPLES.md#2-units-and-coordinate-systems)). Every other unit appears in the name: `angleDeg`, `durationMs`, `sizePx`, `costMm`. | NC §Objects; 95 · N\*                 |
| NC-31 | Call, slider step, and frame are different concepts. No name implies they share the same unit.                                                                                                                               | NC §Objects (tick, step, frame) · N\* |
| NC-32 | `seed` is never the name of a continuation state.                                                                                                                                                                            | NC §Language (seed) · N               |

## Operations

Exactly one verb per kind of operation (NC §Operations; verb families set by David on 2026-11-11 · D). The table applies to new operations. Queue and signal verbs from the library (`request`, `cancel`, `release`, `wait`, `activate`) are introduced only when such operations exist.

| Kind                    | Verb                                    | Do not use                       | Rule                                                |
| ----------------------- | --------------------------------------- | -------------------------------- | --------------------------------------------------- |
| Create                  | `create`                                | make, build, new\*               | `Name.create(options)` creates and inserts nowhere. |
| Insert                  | `add`                                   | put, insert, register, push      | Any membership addition.                            |
| Remove or empty         | `delete`                                | remove, clear, destroy           | With no argument, empties the container.            |
| Take out and return     | `take`                                  | pop, dequeue                     |                                                     |
| Read state              | `read`                                  | get, observe, snapshot (as verb) | Mutates nothing.                                    |
| Write value             | `set`                                   | update, assign                   |                                                     |
| Filter members          | `select`                                | find, query, filter              | Predicate in, members out.                          |
| Random draw             | `sample`                                | pick, choose                     | Consumes draws from an explicitly passed stream.    |
| Execute                 | `run`                                   | start, play, simulate            |                                                     |
| Start and restore       | `setup`, `reset`                        | init, initialize                 | `reset` is a defined restoration.                   |
| Spatial change          | `move`, `rotate`                        | place, setPosition               | Position is a property, movement is a verb.         |
| Representation boundary | `validate`, `parse`, `encode`, `decode` | —                                |                                                     |
| Computed result         | Noun                                    | get\*, find\*, compute\*         | `neighbors`, `distances`, `quality`.                |

A domain verb names only what no row covers. Accepted names of existing contracts stay (`compile`, `transact`, `undo`, `redo`, `assemble`, `toPatch`, `parcelize`, `trace`). `dispose` stays as the three.js platform name. Public action and UI label mean the same thing.

## Type Roles

Use a suffix only when it distinguishes a genuine role (NC §Types and state · N).

| Suffix        | Meaning                                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `Options`     | Optional choice on an operation.                                                                                                   |
| `Parameters`  | Domain inputs of a generator or scene.                                                                                             |
| `Spec`        | Declarative description interpreted by an operation.                                                                               |
| `State`       | State with a documented owner and lifecycle.                                                                                       |
| `Snapshot`    | Detached capture of declared state; alone does not promise complete continuation ([PD-8](PROCEDURAL_PRINCIPLES.md#1-determinism)). |
| `Observation` | Detached output for view or measurement.                                                                                           |
| `Result`      | Output of an operation when no more specific domain noun fits.                                                                     |
| `Data`        | Pure transport or representation form.                                                                                             |

No `I` prefix, no `Impl` suffix, no `Manager`, `Helper`, `Utils` containers. `Config` and `Options` are not interchangeable. `History`, `Intent`, and `Model` are unambiguous only within their owner; imports are qualified when needed (103).

## Variants, Formats, Sources

| ID    | Rule                                                                                                                                                                                                                                     | Source · Auth.   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| NC-40 | A variant is named after its exact behavior. Before naming, seed handling, draw consumption, and ordering are fixed ([PD-2 to PD-7](PROCEDURAL_PRINCIPLES.md#1-determinism)).                                                            | NC §Profiles · N |
| NC-41 | `standard`, `compatible`, `legacy` never mask an open contract.                                                                                                                                                                          | NC §Profiles · N |
| NC-42 | Own identifiers carry no third-party brands or project names. Example: the Bible says "Townscaper quad," the code says `quad-irregular`. Source identity lives in citations ([DOC-50](DOCUMENTATION_STANDARDS.md#sources-and-licenses)). | NC §Profiles · N |
| NC-43 | A format identifier describes an actual representation. Renaming it is a declared format migration.                                                                                                                                      | NC §Profiles · N |

## Migration

A public name migrates together with its callers, exports, docs, and checks. Behavior, identity, ordering, errors, random draws, and accepted assertions stay unchanged. No second alias kept solely for the old name. Renamed only upon documented ambiguity, never as language cleanup (NC §Status and migration; 103 · N).

## Checklist

- Does the name express exactly one concept from the glossary?
- Do casing, singular/plural, verb, and type role match the meaning?
- Is the name understandable without knowing a specific round, lab, or earlier project?
- Is every unit other than meters or radians stated in the name?
