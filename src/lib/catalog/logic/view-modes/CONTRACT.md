# Resolve a stage view

`resolveView(policy, request?)` takes a step's view policy and optional view
and display IDs. Omitted IDs use the policy defaults. An invalid policy or an
explicitly unavailable selection raises `RangeError`. The result is frozen
and can be passed directly to `stage.setView`.

Resolving a view requires no world or renderer.

`sectionThrough(point, normal)` normalizes a nonzero horizontal vector to
a world-space section plane. The plane keeps points with
`dot(normal, point) <= offsetM`. Invalid inputs raise `RangeError`.
The stage chooses the transect when it loads a world.
