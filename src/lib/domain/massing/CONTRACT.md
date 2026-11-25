# Massing

`createHouseOccupancy` fills a cell space using metric block inputs, a uint32 seed and resolved
occupancy parameters. It keeps cell order and returns half-open storey runs, ordered entrance
paths and a reason when the plot cannot be built. Site callbacks sample the selected frontage
midpoint in plan meters and assign phase and use by datum index and cell ID. Only occupied
storeys take program rows. The eaves, cell jitter and open ground draws retain their independent
seed keys. The fixed example places an office above a raised entrance in one frontage cell.

`cellOverrides` can set the occupied storey count of an existing built column by fine-cell ID.
The run keeps its original floor. Counts above the house cap clamp to the cap. Zero clears the
column and preserves an open passage if the column was a gate. Negative, fractional, and
unknown cell overrides raise `RangeError`. The final occupancy checks the entrance and shared
court access before the house derives surfaces or part addresses.
