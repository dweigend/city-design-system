# Catalog

`createCatalog({ rows })` snapshots the supplied rows in registration order. The catalog,
`ids`, `rows`, and lists are frozen. Rows retain their original identity and ownership.
Keep their IDs stable after registration.

IDs are exact strings. The default rule requires a nonblank ID. Supply `validateId` to
define a different string rule. Duplicate IDs and failed validation throw `RangeError`.
`validateRow` runs after the ID checks. It can reject a row by returning false or throwing.

`has` tests membership. `get` reads a row and throws `RangeError` for a missing ID unless
`missingError` supplies another error. `list` accepts a predicate and preserves row order.

The fixed [example](example.ts) filters the registered rows by their kind.
