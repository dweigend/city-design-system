# Scripts

Run tests, checks, builds and browsers through `heavy-slot` on the shared server.

| Command                    | What it does                                                                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bun run bootstrap`        | Checks the pinned Bun version, installs frozen dependencies and syncs SvelteKit. Links private skills and suggests a free dev port.                                                        |
| `bun run lint`             | Checks formatting and runs ESLint, including the rules for slots, exports, styles, controls, headless globals and the stage.                                                               |
| `bun run check`            | Syncs SvelteKit and checks types for the app, tests and scripts.                                                                                                                           |
| `bun test`                 | Runs unit tests and the architecture probes. Run `bun test scripts/rules.test.ts` for the probes alone.                                                                                    |
| `bun run check:boundaries` | Checks file and module-folder cycles, layer direction, public entries, headless imports, stylesheets, routes and three.js. Counts distinct domain peers from the dependency-cruiser graph. |
| `bun run check:skills`     | Checks that Git tracks no private skills.                                                                                                                                                  |
| `bun run build`            | Builds the app with Vite.                                                                                                                                                                  |
| `bun run verify`           | Runs lint, type checks, tests, import boundaries, the private-skill check and the build. It reports every result and fails if any step fails.                                              |

The [architecture rules](../docs/standards/ARCHITECTURE.md#rules) name the checks. Each test in `scripts/rules.test.ts` uses a failing and a passing source tree from `scripts/fixtures/rules/`. The probes apply the production lint and graph rules to the fixture paths. Bun skips the fixture trees during test discovery. ESLint, TypeScript and dependency-cruiser exclude them from product checks.

## Capture the preview

Start Vite in the clean `rebuild` worktree and keep it running for the capture.

```sh
heavy-slot -- bun run dev --host 127.0.0.1 --port 5182 --strictPort
heavy-slot --wait 180 -- bun run shot
```

Shot verifies the preview worktree and revision, then captures `/` in Chrome at 390 × 844 and 1280 × 640. Each route gets viewport and full-page shots at both sizes. The Interface route also gets a full-page dark desktop shot. The script checks the browser's GPU and writes the screenshots and manifest under `_lokal/rebuild-shots/`. Pass a route to capture a different page. Supply `--reference /absolute/path/to/image.png` or a matching first-parent capture with `--before <shot-folder>` to create comparison sheets.

## Ship a package

Run `bun run ship <package-branch>` from the clean package worktree with the rebuild preview running. Ship checks the package against the current `rebuild` base, captures the base, pushes the merge to `rebuild` and captures it. It removes the package worktree and branch after recording the delivery. Pass `--package <id>`, `--started-at <UTC timestamp>` and `--reference <path>` to include the package details.
