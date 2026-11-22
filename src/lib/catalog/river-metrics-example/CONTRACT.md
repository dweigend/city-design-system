# River metrics example

Kind: example
Subject: logic/river-metrics
Purpose: Measures the bend of the river inside the valley study window.
Exports: measureRiverReach
Outputs: Sinuosity and the count of border contacts, or null when the river misses the window.
Input: xy | ArrayLike<number> | m | Valid interleaved course vertices in downstream order | Required
Input: windowM | number | m | Finite and positive | Required

The host supplies the river course and sampling window. The river metrics contract owns clipping and input validation.
