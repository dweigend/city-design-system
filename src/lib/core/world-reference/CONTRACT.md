# World references

`WorldReference` is JSON with `v: 1`, `world`, `kind` and `key`. The adapter assigns an opaque
world ID to one address space. The adapter owns its vocabulary of kinds so a second library
can introduce a kind without changing the format. Keep keys opaque, including when a key
contains a JSON array or a delimiter. `readWorldReference` returns undefined for a malformed
reference or an unknown version.

An adapter can resolve a current value or return `invalid-reference`, `different-world`,
`unsupported-kind` or `missing`. Revisions belong to the record being replayed. An address
can identify the same feature through many snapshots of one world.
