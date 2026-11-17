# Browser scenarios

Playwright scenarios for the design bible, Chromium only. They run the real site, not the headless catalog, and never import catalog components.

```sh
bun run test:browser                                   # full suite, starts vite dev on 127.0.0.1:5191
EVIDENCE_DIR=/abs/path bun run test:browser e2e/evidence.e2e.ts   # opt-in screenshots + manifest.json
```

Projects: desktop 1366 × 768 and narrow 390 × 844, each in light and dark, plus one desktop-light run with reduced motion ([DS-70](../docs/standards/DESIGN_STANDARDS.md#browser-and-screenshot-sign-off)). Every test fails on a console error or page error.

| Spec               | Checks                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| `routes.e2e.ts`    | Every route loads with its heading, no horizontal scroll; legacy redirects; reduced-motion start.  |
| `a11y.e2e.ts`      | Accessible names, keyboard reachability of every visible control, visible focus.                   |
| `flow.e2e.ts`      | Chapter navigation, color mode, Play/Pause, seed, reroll and reset of the growth demo.             |
| `lifecycle.e2e.ts` | Mount, leave, return: stable canvas count, no rendering after unmount.                             |
| `evidence.e2e.ts`  | Screenshots per route or demo × viewport × theme, with SHA, diff hash, seed, browser and renderer. |

`support/routes.ts` is the one table of pages and demos. A new page or demo needs one row there and is then covered by the route checks and the screenshot capture.

Headless Chromium renders WebGL with SwiftShader. Its images are visual evidence, never performance evidence ([DS-73](../docs/standards/DESIGN_STANDARDS.md#browser-and-screenshot-sign-off)). Specs are named `*.e2e.ts` so `bun test` never collects them; types are checked by `tsconfig.e2e.json` in `bun run check`.
