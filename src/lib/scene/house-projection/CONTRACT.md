# House projection

The projection draws the house object's role slots with the stage's display levels, as an
architectural model (MAT-3). Each style row names model materials per role (`main`, `second`,
`accent`, `roof`) and maps body slots to roles; `planHouseMaterials` draws one material per role
for a house, keyed by the house ID and the seed, so a house has at most three materials (MAT-10)
and each body wears one (MAT-7). Plain bodies are painted in their material's flat tone; claddings
are built only where needed: a printed pattern the level shows, the flat roof tone, and a skin that
recesses the openings of a body that has any. Faces of one body share one pattern box, so stripes
wrap the body (MAT-9).

The surface level (near, mid, far, pencil; `relief` and `flat` are aliases of near and far)
decides what is drawn: far is the plain body with its roof tone, without openings and accents.
Builds are cached per object, faces, materials and options, so a change of display or focus
rebuilds nothing that exists. Patches and placement translations use meters and rotations use
radians. See the fixed specimen in `example.ts`.
