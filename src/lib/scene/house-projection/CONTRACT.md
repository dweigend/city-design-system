# House projection

The projection draws the house object's role slots with the stage's display levels, as an
architectural model (MAT-3). Each style row names model materials per role (`main`, `second`,
`accent`, `roof`) and maps body slots to roles; `planHouseMaterials` draws one material per role
for a house, keyed by the house ID and the seed, so a house has at most three materials (MAT-10)
and each body wears one (MAT-7). Plain bodies are painted in their material's flat tone; claddings
are built only where needed: a printed pattern the level shows, the flat roof tone, and a skin that
recesses the openings of a body that has any. Faces of one body share one pattern box, so stripes
wrap the body (MAT-9).

The surface level defaults to `plain`, a matte body with hairline edges. White board is the
default, and a style specimen or sandbox house may supply a tint from the model palette.
Salience grants `mid` or `near` as appropriate. Pencil is a separate display;
`flat` and `relief` are aliases of `plain` and `near`. Builds are cached by geometry
and cladding inputs. Patches and translations are in meters, and rotations are in radians.
