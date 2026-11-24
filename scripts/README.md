# Scripts

Run tests, checks, builds and browsers through `heavy-slot` on the shared server.

| Command                    | What it does                                                                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bun run bootstrap`        | Checks the pinned Bun version, installs frozen dependencies and syncs SvelteKit. Links private skills and suggests a free dev port.                                                        |
| `bun run lint`             | Checks formatting and runs ESLint, including the rules for slots, exports, styles, controls, headless globals and the stage.                                                               |
| `bun run check`            | Syncs SvelteKit and checks types for the app, tests and scripts.                                                                                                                           |
| `bun test`                 | Runs unit tests and the architecture probes. Run `bun test scripts/rules.test.ts` for the probes alone.                                                                                    |
| `bun run test:browser`     | Loads every chapter and exercises the stage, chapter controls, specimen filtering and sandbox in Playwright.                                                                               |
| `bun run check:boundaries` | Checks file and module-folder cycles, layer direction, public entries, headless imports, stylesheets, routes and three.js. Counts distinct domain peers from the dependency-cruiser graph. |
| `bun run check:config`     | Checks the settings catalogue for duplicate keys, invalid metadata and unrecognized design principle IDs.                                                                                  |
| `bun run check:naming`     | Checks public function verbs and US English spelling in core, domain, world and scene entries.                                                                                             |
| `bun run check:skills`     | Checks that Git tracks no private skills.                                                                                                                                                  |
| `bun run build`            | Builds the app with Vite.                                                                                                                                                                  |
| `bun run verify`           | Runs lint, type checks, tests, import boundaries, configuration and naming checks, the private-skill check and the build. It reports every result and fails if any step fails.             |

The [architecture rules](../docs/standards/ARCHITECTURE.md#rules) name the checks. Each test in `scripts/rules.test.ts` uses a failing and a passing source tree from `scripts/fixtures/rules/`. The probes apply the production lint and graph rules to the fixture paths. Bun skips the fixture trees during test discovery. ESLint, TypeScript and dependency-cruiser exclude them from product checks.

## Browser tests

`bun run test:browser` starts a Vite preview on a free loopback port and stops it when Playwright exits. Local runs build the app before starting the preview. Set `CITY_BROWSER_SKIP_BUILD=1` to reuse an existing build; GitHub Actions (`GITHUB_ACTIONS=true`) reuses the output from `bun run verify` and builds if missing.

Local runs require Chrome and the AMD render device `/dev/dri/renderD128`. On the shared server, use the slot wrapper with the explicit test file path for both Radeon and CI-mode runs.

```sh
heavy-slot --exclusive --mem 4G --wait 900 -- bun run test:browser scripts/browser/flows.browser.ts
heavy-slot --exclusive --mem 4G --wait 900 -- env CI=true bun run test:browser scripts/browser/flows.browser.ts
```

CI uses Playwright Chromium, installed with `bunx playwright install --with-deps chromium`. It uses SwiftShader for Vulkan and WebGPU. The suite requires a rendered stage in both modes.

## Capture the preview

Start Vite in the clean `rebuild` worktree and keep it running for the capture.

```sh
heavy-slot -- bun run dev --host 127.0.0.1 --port 5182 --strictPort
heavy-slot --wait 180 -- bun run shot
```

Shot verifies the preview worktree and revision, then captures `/`, `/landscape`, `/interface` and `/blocks` in Chrome at 390 × 844 and 1366 × 768. Each route gets light viewport and full-page shots at both sizes. Interface also gets dark shots at both sizes, Blocks gets a dark desktop shot, and the contents page gets a dark phone shot with the chapter menu open.

For Blocks, Shot waits for the first frame and checks the stage's WebGPU adapter. Other pages use the browser's WebGL hardware check. Screenshots and the manifest are saved under `_lokal/rebuild-shots/`.

Pass one or more routes to capture specific pages. Use `--size desktop` to capture only that size and put the Blocks view or display in the URL.

```sh
heavy-slot --wait 180 -- bun run shot --size desktop '/blocks?view=plan&display=transparency'
```

Supply `--reference /absolute/path/to/image.png` or a matching first-parent capture with `--before <shot-folder>` to create comparison sheets.

## Ship a package

Run `bun run ship <package-branch>` from the clean package worktree with the rebuild preview running. Ship checks the package against the current `rebuild` base, captures the base, pushes the merge to `rebuild` and captures it. It removes the package worktree and branch after recording the delivery. Pass `--package <id>`, `--started-at <UTC timestamp>` and `--reference <path>` to include the package details.

## Performance baseline

On the Radeon server, run:

```sh
heavy-slot --exclusive --mem 4G --time 600 --wait 900 -- bun run perf:baseline
```

The command builds the preview, starts it on a free loopback port, and closes Chrome and Vite when the run ends. Compare mode is the default. Use `-- --skip-build` in compare mode to reuse the current build. Linux runs require an explicit `--exclusive` reservation. The table shows the measured values, differences and limits. Each timing, draw-call and tile-pack metric with a reference limit allows the larger of 50% growth and its configured absolute noise floor. The command fails if a hard limit or a reference limit is exceeded, or if a route cannot prove hardware AMD WebGPU. It warns if the browser, driver or viewport changes and requires an updated reference for a schema change. To refresh the reference, start with a clean worktree and replace the command suffix with `bun run perf:baseline -- --write`. Reference runs always build fresh. The JSON records the revision, timestamp, inputs, hardware and results.

Each Bun case starts in a fresh process. Both use the organic plan with seed 1201. The 1,800 m town builds every private parcel. The 7,000 m case builds the complete terrain, plan, parcel network, ground movement graph, lattice and ground drawables. It places and projects houses from 200 blocks evenly spaced in the private-block order. Plain and salient projections count and release house drawables one house at a time. The sample keeps the largest case within the slot while retaining actual placement and projection timings. The pipeline reports its full wall time, output counts, heap and RSS after each measured stage, plus process peak RSS. Preparation between stages is included in the total.

Chrome runs headless with native Radeon Vulkan, a 1366 × 900 viewport and DPR 1. Each route begins in a fresh browser context. Architecture measures first frame for the two blocks and hall (`block=town`). A separate **Whole town** run (`block=all`) measures camera updates with default salient detail. Sandbox runs pointer drag, wheel zoom, parcel hover and one 30-parcel Paint stroke followed by Undo. Each load opens a generated save with the public file picker in a fresh Sandbox context. The small save uses 300 private placements and the full save uses every available private parcel. Paint, Undo and file loads end at the first stage submission observed after the expected placement count and empty build queue have been published. Tile packs are the change in the stage’s cumulative chunk rebuild counter during the operation.

First-frame time runs from navigation start to the first observed stage submission. Pan, zoom, hover and Architecture navigation each use four short gestures of 26 driven updates. Frame percentiles use at least 100 intervals within those gestures and exclude the pauses between them. The separate paint stroke reports its own interval count. The stage CPU metric includes camera, style and render submission work and excludes queued house generation before the draw. Frame intervals also include input pacing, Playwright dispatch and any work between submissions. Browser heap is Chrome JavaScript heap used after a requested garbage collection at the end of the workload. Peak browser RSS is sampled roughly every 200 ms and sums Chrome’s reported process IDs, including shared pages counted by each process. The reference records host load, available memory, swap and available DRM readings before and after the run. Desktop activity can affect the result.
