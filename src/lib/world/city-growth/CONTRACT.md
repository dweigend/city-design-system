# City growth

`createCityGrowth(site, recipe, seed)` founds a village on a fixed parcel and lane carrier.
Spread `defaultCityGrowthRecipe` to set a plan family, time range, budget or scoring weight.
Use any family offered by City Site and an unsigned 32-bit seed. The carrier size is in
meters and uses the City Site bounds and size increments (CITY-11, GRID-5).
See the [growth settings](../../../config/city-growth/index.ts) for the recipe bounds.

## Founding and expansion

Creation reads the buildable city grid and its parcel program on the current terrain
revision. Ordinary growth keeps a holding's source cell addresses, whole parcel ring, corner addresses
and frontage portal (CITY-15, CITY-16). Candidates have dry sampled ground and a footprint
inside the parcel. Public-use parcels in the carrier are reserved for public uses.

The first holding starts in a lane component with room for the founding cluster. The
score favors ground near a low terrace, higher dry terrain on either side for shelter,
gentle slope, a nearby dry landing approach and reachable neighboring holdings. Near a
sampled channel, the parcel needs the recipe's freeboard above that local water surface.
Water surface plus freeboard is the model's flood threshold (CITY-13). On ground without a
nearby channel, the terrace score uses the carrier datum.

The remainder of the cluster and later growth choose from the active frontage lanes.
Connections follow shared lane node IDs, within the recipe's limit on new intervals.
From a given lane, routes favor fewer intervals, then canonical lane address order.
A shorter extension in meters improves a holding's score (CITY-6). Each decision uses a
seed draw keyed by the decision and parcel address. Equal scores prefer the earlier
canonical parcel address.

`advanceCityGrowth(run, throughYear)` applies the per-step budget at each scheduled year
through the requested year, capped at `endYear`. The schedule starts at `startYear` and repeats
at `stepYears`. The seeding year uses the founding size. Empty terrain, a component too
small for founding, an exhausted frontage or the active holding limit can leave the
history shorter than the budget. Invalid recipe values and fractional dates throw
`RangeError`. Calls with an earlier or equal target return the input run.

## Events and replay

A `holding-settled` event commits the holding, any access intervals first used in that
event, and one building. Each storey spans consecutive planes of the site recipe's storey
stack. The first floor sits at or above the highest sampled point under the footprint.
The foundation, when present, reaches from the lowest sampled point to that floor.
Part IDs combine the building address, part kind and storey index (at the bottom plane for
storeys, and at the supported first-floor plane for a foundation; GROW-2, GROW-3).

Part IDs for a subdivided holding also include the fine-cell address. Every building and
part has its construction year, `styleId` and `use`. `eras` lists strictly increasing
calendar thresholds. The latest threshold at or before the construction year supplies
the style. The default thresholds move from neutral to Memphis, Archigram and organic.
Years before the first threshold use neutral. Older parts keep their construction labels
(FORM-10, COLOR-4, COLOR-5).

## Stock changes

Use `stockChanges` to schedule work on existing holdings. Settlement runs first on
its usual dates. Stock changes run on their own integer dates after founding and through
`endYear`. Changes on the same date follow recipe order. With a `holdingId` the
change targets that holding. Without one, a draw keyed by the change and holding ID
ranks the candidates. Equal ranks use canonical ID order. If no candidate meets the
change's requirements, the history advances without an event. Every committed event
takes the next sequence number for that year, starting at zero (GROW-1, GROW-4).

| Recipe kind | Event                | Effect                                                                                                                                                                                                                                            |
| ----------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `infill`    | `building-infill`    | Adds the reserved rear wing once, sharing a side with the front wing and opening onto the reserved route.                                                                                                                                         |
| `extend`    | `building-extended`  | Adds storeys over cells that reach the current highest roof. Defaults to the use of each supporting roof storey.                                                                                                                                  |
| `convert`   | `building-converted` | Changes the use of eligible storey parts. Optional `fromUse` and `partId` narrow the selection. The part keeps its geometry, ID, style and build year, and records its latest `convertedYear`. The building's `use` records its original program. |
| `retire`    | `building-retired`   | Closes the active interval of an unprotected building. The holding and its lane stay active. The retired building and its last parts are available in `snapshot.retiredBuildings`.                                                                |
| `split`     | `holding-split`      | Divides a vacant, unprotected holding inward from the portal midpoint if there is room for one more active holding. Each child needs the configured minimum area and direct frontage on the original lane. The cut must meet the minimum depth.   |

The recipe opts into the frontage-strip cell plan by scheduling infill or giving an era
a positive `setbackDepth` or `porosityRatio`. At creation, a fitting plan reserves a
dry, side-connected route from the portal midpoint to the rear court. The front wing
and its available rear neighbor both border the route. The base floor clears the
sampled terrain under both wings. A holding where the plan cannot fit uses the compact
single-footprint building and remains eligible for plain vertical extensions. Terrain
samples for both plans are captured before advance. The stock-change events preserve
earlier parts and the reserved open cells (CITY-3, CITY-15, FORM-1, GROW-2, GROW-3).

Setback and porosity shape new upper slices on the cell plan. Both keep each occupied
column's first slice for that construction event. Setback removes upper slices by cell
depth from the frontage and porosity uses a keyed seed to carve supported openings.
The cutters receive only new runs, so later work keeps all previously committed geometry.

A split replaces an active predecessor with two vacant child holdings. Each child
appends its side index to the predecessor's `splitPath`, records `parentHoldingId`,
and inherits the source cells. The event records the predecessor and ordered child IDs.
Splitting occupied ground requires a separate retirement event first. IDs listed in
`protectedHoldingIds` cannot be retired or split. All historical stock remains in the
event log.

## Cursors

Version 2 histories capture the stock-change rules and their event data. Each event carries
the data needed to replay it.

| `readCitySnapshot` cursor  | Included events                                              | Parts marked as additions           |
| -------------------------- | ------------------------------------------------------------ | ----------------------------------- |
| Omitted                    | Through the run's advanced year                              | Parts built that year               |
| `{ kind: 'year', year }`   | Through the selected year, capped at the run's advanced year | Parts built in the resulting year   |
| `{ kind: 'event', index }` | Through the inclusive zero-based index                       | Parts created by the selected event |

Index `-1` and a year before founding both give an empty prefix. Other indices outside
the history throw `RangeError`. Replay lists holdings, lanes and buildings in activation
order. Runs and snapshots are frozen and share committed geometry. Advancing uses the
captured lane graph and ground readings. Create a fresh run to use a different terrain
revision. The event stream is plain data. Continuing a run also requires its in-memory
carrier.

The [example](example.ts) reads a seeded valley after scheduled infill, extension and conversion.
