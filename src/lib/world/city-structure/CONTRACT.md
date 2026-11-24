# City structure

The adapter takes the addressed lattice and its level datum. Its graph preserves all node
and edge IDs across all carriers and uses the lattice's ground-contact flag for pinned seats.
A tree foot sitting on a foundation cap still transfers load through the foundation.

A face used by one solid defines the exposed shell. Primary members are shell columns and
braces, roof rims, and shell chords on every third common level. Edges between two ground
contacts stay light. Assigning sections leaves the rest of the lattice in place. The rule
uses solid topology and elevations, without separate rules for grid or carrier families.
Matching faces must have identical joint loops up to reordering for the shell test.

The gravity case approximates occupancy by nominal weight per cubic meter of each solid.
The highest joints of each solid share its weight equally. The load case is separate from
the graph so other consumers can replace it.
