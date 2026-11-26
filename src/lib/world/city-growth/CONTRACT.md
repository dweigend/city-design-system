# City growth

`createCityGrowth(site, recipe, seed)` founds a village on a fixed parcel and lane carrier.
Spread `defaultCityGrowthRecipe` to set a plan family, time range, budget or scoring weight.
Use any family offered by City Site and an unsigned 32-bit seed. The carrier size is in
meters and uses the City Site bounds and size increments (CITY-11, GRID-5).
See the [growth settings](../../../config/city-growth/index.ts) for the recipe bounds.

## Founding and expansion

Creation reads the buildable city grid and its parcel program on the current terrain
revision. A holding keeps its original cell addresses, whole parcel ring, corner addresses
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
Part IDs combine the building address, part kind and storey index at the bottom plane
(GROW-2, GROW-3).

The event stream is ordered by calendar year and then by sequence, starting at zero
each year (GROW-1, GROW-4). An event's payload contains the geometry needed to replay it.
Later rules can add event kinds with the same date and sequence fields. A replay handler
applies each new kind to the affected addresses. This lets a later storey, split, conversion
or infrastructure project carry its own build date and provenance.

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

The [example](example.ts) reads the last year of a seeded valley using the default recipe.
