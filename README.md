# City Design System

Visual design bible for a city-builder game, built as a SvelteKit application that translates the procedural logic of its sister library [city-library](https://github.com/dweigend/city-library) into visual design, 3D geometry, and interface.

## Guiding Vision

We are designing a sustainable, self-sufficient city of the future with closed material cycles — drawn somewhere between art, architectural drafting, and built utopia rather than as a conventional city builder.
In the tradition of Bauhaus, Memphis, Brutalism, Archigram, Superstudio, and contemporary timber architecture, existing stock is not demolished, but converted, vertically extended, and densified.
The city needs no streets: all paths run along elevated walkways above the alleys and belong to pedestrians.
Rainwater feeds the sponge city, and every component keeps moving through the cycle with its own passport and history.

## Contents and Structure

The design bible moves from the whole to the detail and is organized into two sections with nine chapters (`src/routes/`):

### Bible (binding rules for visual grammar and engine)

- **City** (`/`) – Guiding vision, building on existing stock, elevated walkways, sponge city, and component passports
- **Forms** (`/formen`) – Structural systems, folded plates, stacking, deformation, and towers
- **Grid** (`/raster`) – Universal base measure from checkerboard to organically grown old town
- **Growth** (`/wachstum`) – Organic city genesis: paths first, then blocks and parcels
- **Color** (`/farben`) – Functional color coding for five flows against quiet existing stock
- **Material** (`/material`) – Material families, surface recipes, and structural stages
- **Interface** (`/interface`) – Isometric icons, control panels, HUD, and building views

### Workshop (derivation, simulation, and image archive)

- **Lab** (`/labor`) – Full world simulation, procedural principles, and workbench studies
- **Archive** (`/archiv`) – Cataloged image collection of designs, raw material, and references
- **Legacy redirects** – `/bibliothek`, `/design`, `/designs`, `/fokus`, `/icons`, `/modellierung`, and `/prinzipien` are only redirects to the corresponding chapter pages

### Catalog (`src/lib/catalog/`)

All modules live strictly separated under `src/lib/catalog/`:

- `data/` – Tokens, grid measure (`1 U = 4 px = 1 m`), catalog data, guiding vision, chapters, and precomputed states
- `logic/` – Headless algorithms (`ansicht`, `bibel`, `farbe`, `formen`, `haus-tragwerk`, `leitstil`, `material`, `modellierung`, `parametrik`, `parzelle`, `stadt`, `statik`, `traeger`)
- `scene/` – 3D projection, cameras, hatching, and stages with three.js (`leitstil`, `stadt`, structural systems, world)
- `ui/` – Interactive building blocks based on Bits UI (`Button`, `Checkbox`, `Icon`, `Metric`, `Scale`, `Selection`, `Switch`, `Tabs`, `Tag`, `Tile`, `TileGrid`, `Tooltip`, `Vertiefung`)
- `bibel/`, `design/`, `foundations/`, `theme/` – Page frame, chapter navigation, typography, graph paper, and theme control
- `stadt/`, `formen/`, `raster/`, `modellierung/`, `color/`, `material/`, `interface/`, `labor/`, `library/`, `werkbank/` – Domain chapters and interactive lab modules

## Getting Started and Checks

Requires [Bun](https://bun.sh).

```sh
bun install
bun run dev                # Development server (http://localhost:5173)
```

Mandatory verification commands before every delivery:

```sh
bun run test               # Behavior tests (bun test)
bun run check              # svelte-kit sync & svelte-check (type and Svelte check)
bun run lint               # Prettier & ESLint (including CSS boundary checks)
bun run build              # Production build
bun run check:boundaries   # Architecture and import boundaries (dependency-cruiser & AST)
```

## Architecture

1. **Headless core (`data/` and `logic/`):** Pure TypeScript data and deterministic procedural algorithms with no dependencies on Svelte, DOM, or `three.js`.
2. **3D projection (`scene/`):** Translates domain data exclusively with `three.js` into isometric and perspective stages, edges, sections, and materials.
3. **UI components (`ui/`):** All UI controls are based on [Bits UI](https://www.bits-ui.com) and mutate domain state exclusively through defined public actions.
4. **Strict style boundaries:** `src/app.css` defines only global tokens; components encapsulate their styles locally, and pages under `src/routes/**` contain no CSS of their own.

## Branches and Local Working Files

- `main` – stable primary branch on GitHub.
- `experimente` – public experimental branch on GitHub (`main` plus ongoing experiments; rebased onto `main` after every merge into `main`).
- `_lokal/` – local working directory excluded via `.gitignore` for process images, local originals, and internal records.

## Images and Copyright

Under `static/designs/`, `static/library/`, and `static/references/`, the repository contains exclusively original works, original raw material, and original design adaptations following documented principles (`uebertragung-*.webp`). Copyrighted third-party material and external reference originals remain local and are not part of the repository.

## License

Code (source, scripts, configuration): MIT – see [LICENSE](LICENSE). Texts, images, 3D scenes, and other content: CC BY-NC 4.0 – see [LICENSE-CONTENT.md](LICENSE-CONTENT.md). Third-party sources (e.g., geodata) retain their own licenses; see respective notices.

## Built with

- **Stack:** SvelteKit, Svelte 5, TypeScript, Bits UI, three.js, Bun
- **Author:** David Weigend
- **AI Assistance:** Developed with support from Claude, GPT, and Gemini in conception, implementation, 3D geometry, and reviews.
