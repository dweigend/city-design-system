# Naming Conventions

Use the same name for a concept in APIs, code, tests, UI and documentation.

## Language

| ID    | Rule                                                                                                                                                                                   |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NC-01 | Use US English for repository text, comments, UI copy, identifiers, filenames, folders and routes. Use `center` and `color`. Keep external API names and source quotations as written. |
| NC-02 | Name operations using the [layer verb table](#layer-verb-table). Use the glossary for domain nouns.                                                                                    |
| NC-03 | Commit subjects are in English ([GW-21](../development/git-workflow.md#commits)).                                                                                                      |
| NC-04 | An established domain term beats an abbreviation and a generic infrastructure name. Scientific terms and algorithm names remain intact.                                                |
| NC-05 | Parts of the system do not receive proper names. A part is named after what it is or does.                                                                                             |

## Glossary

Use the [glossary](GLOSSARY.md) for English domain terms. Add a new term before it appears across multiple modules.

## Spelling and Casing

| ID    | Element                                      | Convention                                                                                                          |
| ----- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| NC-10 | Variables, properties, parameters, functions | `camelCase`                                                                                                         |
| NC-11 | Types, classes, component symbols            | `PascalCase`                                                                                                        |
| NC-12 | Svelte component files                       | `PascalCase.svelte`                                                                                                 |
| NC-13 | New modules and folders                      | `kebab-case`, named by capability or responsibility                                                                 |
| NC-14 | Runtime tests                                | `contract.test.ts` for the public module contract, beside `index.ts`; other tests use the capability and `.test.ts` |
| NC-15 | Stable string discriminants and error codes  | lowercase `kebab-case`, e.g. `quality-unattainable`                                                                 |
| NC-16 | CSS classes and custom properties            | `kebab-case` with semantic meaning                                                                                  |
| NC-17 | Route folders                                | lowercase, one word or `kebab-case`                                                                                 |
| NC-18 | Module constants                             | `UPPER_SNAKE_CASE` allowed; local values `camelCase`                                                                |
| NC-19 | Abbreviations in names                       | `Id`, `Url`, `Xml`; `UI` stays uppercase                                                                            |

Existing names are not renamed solely to switch between allowed casings. No names like `new`, `next`, `old`, `legacy` and no opaque phase codes.

## Objects, Collections, Identity

| ID    | Rule                                                                                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| NC-20 | Singular for one object, plural for the collection. Count: `<singular>Count`. No `num*`.                                                         |
| NC-21 | Positive booleans and predicates: `isClosed`, `hasAccess`, `canSplit`. No negative flags.                                                        |
| NC-22 | Identity, index, and label are different things with different names. `id` on the unambiguous owner, otherwise qualified: `vertexId`, `blockId`. |
| NC-23 | Lookup tables are named after their relationship: `cellsById`, `blockOf`.                                                                        |

## Units and Values

| ID    | Rule                                                                                                                                                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| NC-30 | In headless modules, meters and radians are the base units and need no suffix ([PE-1](PROCEDURAL_PRINCIPLES.md#2-units-and-coordinate-systems)). Every other unit appears in the name: `angleDeg`, `durationMs`, `sizePx`, `costMm`. |
| NC-31 | Call, slider step, and frame are different concepts. No name implies they share the same unit.                                                                                                                                       |
| NC-32 | `seed` is never the name of a continuation state.                                                                                                                                                                                    |

## Operations

<!-- prettier-ignore -->
| Kind of operation | Verb | Do not use | Rule |
| --- | --- | --- | --- |
| Construct | `create` | make, new*, build | `Name.create(options)` and `createX(options)` construct without adding membership. |
| Insert into an owner or collection | `add` | put, insert, attach, register, admit, join, record, push (in the API) | Any membership change or append, including one that may wait. |
| Remove or empty | `delete` | remove, detach, clear, dispose, destroy | Removes one member; called with no argument on a container, it empties the container. |
| Take out and return | `take` | pop, dequeue, get | Removes the next item and returns it immediately. |
| Read state | `read` | observe, get, report, snapshot (as a verb) | Returns data without changing anything. "Observation" stays the data noun. |
| Write a value | `set` | update, assign, put | Replaces a value, such as `set` or `setCapacity`. |
| Ticket that may wait | `request` | acquire, get, put | Returns a ticket with a status. |
| Withdraw a ticket | `cancel` | cancelPut, cancelGet, abort | One verb for every ticket type. |
| End a grant | `release` | free, return | Only for granted resource units. |
| Wait for a condition | `wait` | await*, notify, listen | Only on `Signal`. |
| Act on members | `activate` | ask, report, forEach (in the API) | Runs a callback for each member and returns the results. |
| Filter members | `select` | find, query, filter, with, search | A predicate goes in, members come out. |
| Random draw | `sample` | pick, choose | Uses up draws from an explicit `Random`. |
| Move time | `advance` | step or tick as verbs | Only `tick` and `Agenda` advance. A model's `advance(stepCount)` runs steps; it is the delivered model contract. |
| Execute a model | `run` | start, play, simulate | `run` is the driver; `step` and `tick` stay nouns. |
| Start and restore | `setup`, `reset` | init, initialize | `setup` is the start procedure; `reset` is a defined restore. |
| Spatial change | `move`, `rotate` | place, setPosition, jump | Position is a property; movement is a verb. |
| Computed results | nouns | get*, find*, compute* | Such as `neighbors`, `distances` or `route`. |

A domain verb names an operation the table does not cover. Keep `validate`, `parse`, `encode` and `decode` at representation boundaries. Platform APIs keep their spelling. Public actions and their UI labels use the same meaning.

### Layer verb table

| Layer  | Public function verbs                                                                                                    | Examples                                                                               |
| ------ | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Core   | `clip`, `create`, `define`, `draw`, `encode`, `equal`, `is`, `measure`, `move`, `read`, `resolve`                        | `measurePolygon(points)`, `encodePair(a, b)`                                           |
| Domain | `build`, `clip`, `create`, `fit`, `has`, `lower`, `measure`, `read`, `restore`, `run`, `subdivide`, `survey`, `validate` | `createCellSpace(parcel, rounds)`, `buildSurface(family, patch, options)`              |
| World  | `build`, `create`, `list`, `place`, `read`, `sample`, `validate`                                                         | `readCityGrid(site, citySize, variant, seed)`, `buildAsset(id, host, overrides, seed)` |
| Scene  | `create`, `paint`, `plan`, `project`, `read`, `resolve`, `select`, `share`, `validate`                                   | `projectCityTerrain(city, grid, plan)`, `resolveSurfaces(object, surfaces)`            |

Use `build` to realize a recipe or registered asset. A computed query can use the exact name of its result, such as `cellCenter`, `latticeVolumes`, or `cityWindow`. The naming check lists these names explicitly so each new noun has a reviewable entry. `required` is the core invariant assertion.

PascalCase construction owners name the state or lifecycle they encapsulate. `Random` owns a continuing draw stream, `Valley` owns a solved catchment, `TerrainGrid` owns the carrier and its embedding, and `Stage` owns the renderer lifecycle. Their operations use the shared vocabulary, such as `Stage.create`. The public function check covers callable exports. These construction owners expose factory methods.

- Put the subject first, followed by required inputs in dependency order and optional choices last. Ordered endpoints go from start to end, as in `distance(from, to)`.
- Group independent optional choices in a trailing `Options` object. Factories with several named inputs take one object, as in `TerrainGrid.create({ seed, site, variant, heightAt })`.
- Use `TypeError` for an input of the wrong shape, `RangeError` for an out-of-range value, and `Error` for a broken invariant. Document an empty result when absence is expected. `clipPolylineToSquare` returns `null` if no positive-length reach survives.
- Use `id` on the owner and a qualified `Id` name at a reference, as in `planCellId` on a city column. Keep IDs independent of display labels.
- Document and explicitly export each public name from the flat module's `index.ts`. Keep the implementation, `contract.test.ts`, and fixed-input `example.ts` beside that entry.

Run `bun run check:naming` to check callable exports of core, domain, world and scene entries, including named re-exports.

## Type Roles

Use a suffix only when it identifies a genuine role.

<!-- prettier-ignore -->
| Name | Meaning |
| --- | --- |
| `Options` | Optional choices for a specific operation. |
| `Parameters` | Domain inputs to a model or study. |
| `Spec` | Declarative description interpreted or bound by an operation. |
| `State` | Explicit state with a documented owner and lifecycle. |
| `Snapshot` | Detached capture of declared state; no implied complete continuation. |
| `Observation` | Detached model output for inspection or measurement. |
| `Result` | Output of an operation when a more precise domain noun is unavailable. |
| `Data` | Plain transport or presentation representation, where that distinction matters. |

Use `Options` for operation choices and `Spec` for declarative descriptions. Avoid automatic `I` prefixes, `Impl` suffixes and generic `Manager`, `Helper` or `Utils` types. A type lives with its owner.

## Variants, Formats, Sources

| ID    | Rule                                                                                                                                                                                                                                     |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NC-40 | A variant is named after its exact behavior. Before naming, seed handling, draw consumption, and ordering are fixed ([PD-2 to PD-7](PROCEDURAL_PRINCIPLES.md#1-determinism)).                                                            |
| NC-41 | `standard`, `compatible`, `legacy` never mask an open contract.                                                                                                                                                                          |
| NC-42 | Own identifiers carry no third-party brands or project names. Example: the Bible says "Townscaper quad," the code says `quad-irregular`. Source identity lives in citations ([DOC-50](DOCUMENTATION_STANDARDS.md#sources-and-licenses)). |
| NC-43 | A format identifier describes an actual representation. Renaming it is a declared format migration.                                                                                                                                      |

## Migration

A public name migrates together with its callers, exports, docs, and checks. Behavior, identity, ordering, errors, random draws, and accepted assertions stay unchanged. No second alias kept solely for the old name.

## Checklist

- Does the name express exactly one concept from the glossary?
- Do casing, singular/plural, verb, and type role match the meaning?
- Is the name understandable without knowing a specific round, lab, or earlier project?
- Is every unit other than meters or radians stated in the name?
