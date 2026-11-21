# Resolve a stage view

`resolveView(policy, request?)` takes a step's view policy and optional view
and display IDs. Omitted IDs use the policy defaults. An invalid policy or an
explicitly unavailable selection raises `RangeError`. The result is frozen
and can be passed directly to `stage.setView`.

Resolving a view requires no world or renderer.
