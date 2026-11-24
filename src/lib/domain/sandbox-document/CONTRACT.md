# Sandbox document

A document owns a fixed seed, plan family, city size, and terrain and topology revisions. Its ordered transaction log records
placement, removal and replacement of parameters with an optional new seed. A placement uses
the asset registry record plus an ID that encodes the world and exact host address. Each
address owns one slot. A duplicate placement raises `OccupiedHostError`, and edits to an
absent placement raise `MissingPlacementError`. A seed omitted at placement derives from
the world seed and the encoded host. Replacing parameters retains the seed unless supplied.

Each transaction publishes its net changes atomically. Undo and redo apply inverse and forward
changes. `amend` extends the last applied transaction, so a gesture that grows over time stays
one undo step; a transaction whose edits cancel out leaves the history. Only a successful,
state-changing edit drops the redo tail. A caller can supply a
synchronous preparation callback for derived products. The callback must publish its own state
atomically or throw before publication. It must not mutate the document.

One optional resolver canonicalizes and validates every placement and replacement before it is staged.
One derived placement cache may attach to a document and follow its transactions.

The versioned JSON contains the world, ordered strokes and current history position. Restore
validates and replays the complete log, including its redo tail. Saves without snapshot revisions cannot be verified.
