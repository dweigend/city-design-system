# House site

A bay house uses plan corners and addresses its fine cells under `subdivideBay`.
A parcel house uses the permanent city parcel ID and ordered contour, with a local corner key
per vertex. Edges below the cell-space minimum collapse. The portal names the boundary edge containing its interval.
The vertical range starts at the highest first full bay of the block members and ends at the
lowest member roof. Storeys split each remaining level in half.
The object can add a plain plinth down to the lowest member corner. A plinth does not connect
a raised house entrance to the walking graph.
The Town study selects a perimeter block with a court and a buildable merged hall, both from
the default city parcel plan.
