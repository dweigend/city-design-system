# Keys and world references

`encodeKey` encodes an ordered tuple of strings, finite numbers, booleans, and null as a JSON
array. JSON quoting preserves separators and control characters inside string atoms. The encoding
distinguishes strings from the other atom types and writes negative zero as zero. Non-finite
numbers and values outside those types throw `RangeError`.

`encodePair` takes two string or tuple endpoints. Swapping them leaves the encoded pair the
same. String pairs use UTF-16 code-unit order on the strings. Pairs containing tuples use
code-unit order on the encoded endpoints.

`Ref` is a versioned JSON address with fields `v: 1`, `world`, `kind`, and `key`. The adapter
assigns the world ID, owns its vocabulary of kinds, and supplies opaque keys.
`createWorldReference` freezes a new address. `readWorldReference` returns a frozen address
for valid input and `undefined` for malformed input or an unknown version. `equalRefs` compares
the world, kind, and key of two valid references.

An adapter can resolve a current value or return `invalid-reference`, `different-world`,
`unsupported-kind`, or `missing`. Revisions belong to the record being replayed. An address
can identify the same feature through many snapshots of one world.
