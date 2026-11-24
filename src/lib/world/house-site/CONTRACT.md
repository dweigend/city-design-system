# House site

A bay house uses plan corners and addresses its fine cells under `subdivideBay`.
A parcel house uses the permanent city parcel ID and ordered contour, with a local corner key
per vertex. Edges below the cell-space minimum collapse. The portal names the boundary edge
containing its interval.

The cell space of a parcel house is a strip space (`createStripSpace`): columns across the
frontage, depth rows behind it. Parcel edges on the block's public court are its court edges;
the house then opens onto that court and cuts no court of its own. A parcel with another lane
edge turned from its frontage is a block corner; a calm house there may rise above the eaves line.

Without `groundAt` the vertical range starts at the highest first full bay of the block members
and ends at the lowest member roof, two storeys per level. With `groundAt` the house stands on
the first storey plane above the highest ground of its own parcel, still under the lowest member
roof. The entrance rise is that base above the ground at the portal's middle; above a kerb the
entrance cell opens and takes steps from the lane. Ground plates reach down to the lowest ground
of the block as a plinth.

Each house draws its own seed from the input seed and the parcel ID.

The Town study selects a perimeter block with a court, its nearest perimeter neighbour across a
lane and a buildable merged hall, all from the default city parcel plan, on a valley of any relief.
