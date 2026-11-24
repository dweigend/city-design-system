# Sandbox document

A document uses an opaque world ID, terrain and topology snapshot revisions, an asset registry
revision and an optional seed. Each host owns one placement slot. An occupied slot raises
`OccupiedHostError`. An edit to an absent slot raises `MissingPlacementError`. The document
derives and stores the seed on placement. Parameter replacement retains the seed unless supplied.
See the [address table and survival rules](../../world/sandbox-world/CONTRACT.md).

A transaction publishes its net changes atomically. Undo and redo apply the inverse and forward
changes. Only a successful state-changing edit drops the redo tail. A caller can prepare derived
products synchronously before publication or attach one projection to the document. Preparation
must publish atomically or throw before publication and must leave the document alone.

The optional resolver canonicalizes and validates placement parameters. Restore replays every
stroke, including transient edits and the redo tail. If the resolver raises `UnavailableHostError`,
the placement stays in the log at its original slot. `readOrphans` reports retained records at the
current history position. Undo and redo move these records with their stroke. Active placement
queries, history placement counts and the projection include usable records. Restoring against
a snapshot where a host has returned reevaluates the original record.

`sandbox/3` stores the revisions, ordered strokes, history position and a versioned host reference
on each place edit. A document can replay against another snapshot of its own world with the same
registry revision. `UnsupportedSandboxVersionError` identifies `sandbox/1` and `sandbox/2` saves.
Version 2 encoded revisions into slot IDs and allowed floating and positional movement IDs, so
its local identifiers would need an explicit migration.
