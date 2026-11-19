# Paket Q — carrier repair and pointer budget

The house brush repairs each overlong longitudinal diagonal independently. For either crown of its bay, it considers the existing wall bearings on roofs connected to that crown by a crown chord. It discards existing ties and candidates longer than 15 m in three dimensions. The shortest remaining tie wins. Equal lengths retain crown, neighbor and bearing traversal order.

The brush validates the complete installation once with these replacements. If needed, it tries one more layout using each field's second-shortest candidate where available. A layout that repeats a tie is skipped. Each full installation check validates every rod length before running statics. A pointer move therefore costs at most two installation solves plus the one preliminary K2 survey solve. If the layouts fail, the brush reports `wall-layout-unresolved` and retains the base world. A member with no admissible replacement still reports `member-too-long` and marks its endpoints.

## Reproducing the 16 ms test

Run `bun test src/lib/catalog/logic/sandbox/carrier-budget.test.ts`. The headless test uses seed 7 and measures synchronous work with `performance.now()`. It warms each input 12 times and measures 30 repetitions. The assertion applies to the slowest measured call.

- **Singular carrier.** Five or six translated copies of the three-roof picture carrier retain their original 16.738 m diagonals. Crown chords join the copies. A terminal post and a single horizontal chord leave the last crown singular under every repair. The test times the production repair helper on 87 and 104 parts. A separate untimed assertion counts exactly two final probes and checks the rejection reason.
- **Ten roofs.** Ten occupied plots span `30/40` through `48/40` at two-cell intervals. The test replays each of the ten public `extendStroke` calls from its corresponding input snapshot. Timing includes the K2 survey, final validation and draft update. The sample contains 300 individual moves. Grid and fixture setup occur before timing.

| Input | p95 (ms) | Slowest call (ms) |
| --- | ---: | ---: |
| Five groups | 2.42 | 2.90 |
| Six groups | 0.68 | 0.71 |
| Ten roofs | 0.80 | 2.41 |

Measured with Bun 1.4.4 on the project server. These are CPU-side pointer and planner timings. Rendering is outside the measurement.
