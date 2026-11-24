# House site

A bay house uses plan corners and addresses its fine cells under `subdivideBay`.
A parcel house uses its permanent city parcel ID and keyed ring. The portal supplies the directed
frontage side. Edges below the cell-space minimum collapse and the public court
boundary supplies court tags. The parcel ID derives the house seed from the input seed.

The common bay levels of the block members bound the house. When given a terrain sampler,
the strip space samples inside the parcel for its floor and plinth and at the selected entrance
for its lane elevation. A parcel without room for a house and access returns a reason.

The Town study selects two adjacent perimeter blocks and a merged hall from the default plan.
Each block's placement opts into area-based scale and supplies coincident boundary walls
to face and opening derivation after the occupied spans of its houses are known.
