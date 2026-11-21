# Block inputs

`blockInputs` is the common numeric parameter schema. Resolve it with `resolveParams` from the core parameter module. Values inherit the defaults below. Bounds are inclusive.

| Input        | Unit          | Range | Default |
| ------------ | ------------- | ----- | ------- |
| `height`     | m             | 1–32  | 4       |
| `width`      | m             | 1–32  | 9       |
| `complexity` | dimensionless | 0–1   | 0.5     |

The house-and-court example exercises this initial schema.
