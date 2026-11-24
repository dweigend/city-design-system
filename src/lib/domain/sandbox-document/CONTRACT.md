# Sandbox document

A document owns a fixed seed, plan family and city size. Its ordered transaction log records
placement, removal and replacement of parameters with an optional new seed. A placement uses
the asset registry record plus an ID that encodes the world and exact host address. Each
address owns one slot. A duplicate placement raises `OccupiedHostError`, and edits to an
absent placement raise `MissingPlacementError`. A seed omitted at placement derives from
the world seed and the encoded host. Replacing parameters retains the seed unless supplied.

Each transaction publishes its net changes atomically. Undo and redo apply inverse and forward
changes. Only a successful, state-changing edit drops the redo tail. A caller can supply a
synchronous preparation callback for derived products. The callback must publish its own state
atomically or throw before publication. It must not mutate the document.

The versioned JSON contains the world, ordered strokes and current history position. Restore
validates and replays the complete log, including its redo tail. The caller owns the fixed
terrain snapshot and the registry version used to interpret the log.
