# Sandbox document

A document uses an opaque world ID, terrain and topology snapshot revisions, an asset registry
revision, with an optional plan scope and seed. Each host owns one placement slot. Placing over
generated stock keeps the original in the baseline. Placing over an existing player placement
raises `OccupiedHostError`. Removing a player placement reveals the original stock, if any.
Removing the active stock clears the slot. An edit to an absent slot raises
`MissingPlacementError`. The document derives and stores the seed on placement. Parameter
replacement retains the seed unless supplied.
See the [address table and survival rules](../../world/sandbox-world/CONTRACT.md).

A transaction publishes its net changes atomically. Undo and redo apply the inverse and forward
changes. `amend` extends the last applied transaction, so a gesture that grows over time stays one
undo step; a transaction whose edits cancel out leaves the history. Only a successful
state-changing edit drops the redo tail. A caller can prepare derived
products synchronously before publication or attach one projection to the document. Preparation
must publish atomically or throw before publication. The resolver, preparation and initial
attachment callbacks can read the current document. A callback that tries to write to the same
document while a write is in progress receives a `SandboxDataError`.

The optional resolver canonicalizes and validates placement parameters. Restore replays every
stroke, including transient edits and the redo tail. If the resolver raises `UnavailableHostError`,
the placement stays in the log at its original slot. `readOrphans` reports retained records at the
current history position. Undo and redo move these records with their stroke. Active placement
queries, history placement counts and the projection include usable records. Restoring against
a snapshot where a host has returned reevaluates the original record.

## Save format

`sandbox/4` stores `world`, the ordered `strokes`, and the history cursor `position`. An optional
`stock` list stores baseline place records, with their original parameters and seeds, outside the
stroke history. Every place record uses a versioned host reference. Each history stroke stores
its edits in application order.

A house place or replace edit can include `cellOverrides`, a sparse map of fine-cell IDs to
occupied storey counts, and `finishOverrides`, a list of material family and optional tone
values keyed by `Ref<'house-part'>`. Replacement retains either set when omitted and clears it
when given `null` or an empty collection. An atomic remove-and-place stroke starts with the new
placement's own overrides. Undo restores the original placement and overrides.

Restore accepts a same-world `sandbox/3` log with the same registry revision or an explicitly
compatible one. It keeps the saved cursor, redo tail and unavailable records. Resaving writes
`sandbox/4`. A saved plan scope must match the target snapshot. Saves without a plan scope still
compare the world ID. `UnsupportedSandboxVersionError` identifies `sandbox/1` and `sandbox/2`
saves. Version 2 encoded revisions into slot IDs and used different movement addresses.

Restore checks the configured UTF-8 byte limit before JSON parsing and the combined stock and
history edit limit before replay. Edits past the cursor count toward the limit. A save that exceeds
either limit raises `SandboxDataError`.
