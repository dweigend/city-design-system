# Scripts

Run tests, checks, builds and browsers through `heavy-slot` on the shared server.

| Command                    | What it does                                                                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run bootstrap`        | Checks the Bun version against the CI pin, installs the frozen dependencies and syncs SvelteKit. Links private skills and suggests a free dev port.   |
| `bun run verify`           | Runs lint, type checks, unit tests, cycle detection, the private-skill check and the build. Prints a summary and exits with an error if a step fails. |
| `bun run check:boundaries` | Checks the app and scripts for import cycles.                                                                                                         |
| `bun run check:skills`     | Checks that Git tracks no private skills.                                                                                                             |

## Capture the preview

Start Vite in the clean `rebuild` worktree and keep it running for the capture.

```sh
heavy-slot -- bun run dev --host 127.0.0.1 --port 5182 --strictPort
heavy-slot --wait 180 -- bun run shot
```

Shot verifies the preview worktree and revision, then captures `/` in Chrome at 390 × 844 and 1280 × 640. It checks the browser's GPU and writes the screenshots and manifest under `_lokal/rebuild-shots/`. Pass a route to capture a different page. Supply `--reference /absolute/path/to/image.png` or a matching first-parent capture with `--before <shot-folder>` to create comparison sheets.

## Ship a package

Run `bun run ship <package-branch>` from the clean package worktree with the rebuild preview running. Ship checks the package against the current `rebuild` base, captures the base, pushes the merge to `rebuild` and captures it. It removes the package worktree and branch after recording the delivery. Pass `--package <id>`, `--started-at <UTC timestamp>` and `--reference <path>` to include the package details.
