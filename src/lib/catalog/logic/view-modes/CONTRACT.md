# Resolve a stage view

Kind: block
Purpose: Resolves an allowed pose and display mode for the shared stage.
Exports: resolveView, sectionThrough
Outputs: A frozen ResolvedView for the stage or a frozen vertical SectionPlane in world coordinates.
Input: policy | ViewPolicy | — | Allowed IDs include each default | Required
Input: request.view | string | — | policy.views | policy.view
Input: request.display | string | — | policy.displays or the default alone | policy.display
Input: point | readonly [number, number, number] | m | Finite world coordinates | Required for sectionThrough
Input: normal | readonly [number, number] | — | Finite, nonzero horizontal vector | Required for sectionThrough
Example: view-modes-example

`resolveView(policy, request?)` takes a step's view policy and optional view
and display IDs. Omitted IDs use the policy defaults. An invalid policy or an
explicitly unavailable selection raises `RangeError`. The result is frozen
and can be passed directly to `stage.setView`.

Resolving a view requires no world or renderer.

`sectionThrough(point, normal)` normalizes a nonzero horizontal vector to
a world-space section plane. The plane keeps points with
`dot(normal, point) <= offsetM`. Invalid inputs raise `RangeError`.
The stage chooses the transect when it loads a world.
