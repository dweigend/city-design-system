/**
 * Design principles register: the one place where a design rule of the city is written down.
 * Each entry belongs to one bible page, states the rule in one sentence and the reason behind it.
 * Pages render their block from here; a brief cites entries by id. An id is never reused or
 * renumbered: a changed rule keeps its id, a dropped rule leaves a gap.
 */

/** Bible page that owns a principle. */
export type PrinciplePage =
	'city' | 'forms' | 'grid' | 'growth' | 'color' | 'material' | 'interface' | 'library';

/** Routes a principle may point to as its live demo. */
type DemoRoute =
	| '/'
	| '/formen'
	| '/raster'
	| '/wachstum'
	| '/farben'
	| '/material'
	| '/interface'
	| '/sandbox'
	| '/sandbox/regel'
	| '/sandbox/stile'
	| '/sandbox/tragwerk';

export type DesignPrinciple = {
	/** Stable id: page prefix (CITY, FORM, GRID, GROW, COLOR, MAT, UI, LIB), hyphen, number. */
	id: string;
	page: PrinciplePage;
	/** Short name of the rule. */
	title: string;
	/** The rule in one sentence. */
	rule: string;
	/** Why the rule exists and how to read it. */
	reason: string;
	/** Day of the author decision the rule goes back to, ISO 8601. */
	decided: string;
	/** Where the rule can be seen at work: route, optional section anchor, link text. */
	demo?: { route: DemoRoute; anchor?: string; label: string };
};

const city: DesignPrinciple[] = [
	{
		id: 'CITY-1',
		page: 'city',
		title: 'Avant-garde stance',
		rule: 'Every element carries an artistic claim between art, illustration, architectural drawing and built utopia, deliberately unlike a typical city builder.',
		reason:
			'The city is a living collage. Influences are Memphis, Bauhaus, brutalism, Archigram, Superstudio, Ant Farm, Buckminster Fuller and the Centre Pompidou; unbuilt, visionary forms are wanted.',
		decided: '2026-11-11'
	},
	{
		id: 'CITY-2',
		page: 'city',
		title: 'No roads',
		rule: 'The city has no roads: people move on foot, by rail, by capsule and on elevated walkways.',
		reason:
			'Movement is public infrastructure. The hierarchy is promenade, main lane, lane, stair lane and square. A brief never says "street", because the word alone makes roads appear.',
		decided: '2026-11-11',
		demo: { route: '/', anchor: 'hochwege', label: 'Elevated walkways between courts' }
	},
	{
		id: 'CITY-3',
		page: 'city',
		title: 'Build on the stock',
		rule: 'The city starts with existing buildings and retains them through ordinary growth as it converts, extends and densifies them.',
		reason:
			'The sandbox opens with a seeded town, and a stock house can gain storeys on its existing lot. Deliberate path placement follows CITY-4.',
		decided: '2026-11-21',
		demo: { route: '/', anchor: 'weiterbauen', label: 'Retain, convert, extend' }
	},
	{
		id: 'CITY-4',
		page: 'city',
		title: 'Grid-led paths and deliberate cuts',
		rule: 'Routes share one movement graph with grid-derived ports and alignments, and deliberate path placement may cut a passage, opening or gate through occupied space or remove a small building.',
		reason:
			'Typed ports connect walkways, stairs, ramps and rails with length, slope, capacity and mode. The first bridge proof calls for reachable landings on two façades above a central footpath.',
		decided: '2026-11-21',
		demo: { route: '/interface', anchor: 'connections', label: 'Trace a connection to its landing' }
	},
	{
		id: 'CITY-5',
		page: 'city',
		title: 'Paths are thin ribbons',
		rule: 'A path is one thin ribbon with continuous curvature on slender round columns: no pads, no stair stubs, no chunky girders.',
		reason:
			'Junctions are softly filleted, ramps long and gentle, railings hairlines only where the deck is exposed, landings soft on rounded lawn plateaus. Every linear system is a centerline with a swept profile, not stitched parts. This target governs form, paths, ground and light; it never sets the palette.',
		decided: '2026-11-20'
	},
	{
		id: 'CITY-6',
		page: 'city',
		title: 'No clump, no checkerboard',
		rule: 'The city forms several centers, varied architecture and one coherent picture: no clump, no checkerboard.',
		reason:
			'In plan no straight line runs across three blocks. Chains of houses form on the slope, another structure on the plain, and at least one satellite hangs on an overland line. Neighborhood rules work on three levels (cell, quarter, city) and are written as measurable local objectives such as proportion and short paths.',
		decided: '2026-11-19'
	},
	{
		id: 'CITY-7',
		page: 'city',
		title: 'Structure orders space',
		rule: 'The structural frame is a design element: it structures the city, sets boundaries and encloses spaces, also between houses.',
		reason:
			'Where the frame stands and how strongly it is drawn is a design decision in every place. There is no global style switch.',
		decided: '2026-11-19',
		demo: { route: '/sandbox/tragwerk', label: 'Structure in the sandbox' }
	},
	{
		id: 'CITY-8',
		page: 'city',
		title: 'Looks built, not computed',
		rule: 'A structure must look built; it does not have to be statically correct.',
		reason:
			'This is a game. Only what the picture shows is checked: nothing floats, the frame sits on joints, and stroke width is diameter is force. No real load or buildability calculation.',
		decided: '2026-11-19'
	},
	{
		id: 'CITY-9',
		page: 'city',
		title: 'The city moves',
		rule: 'Within ten seconds three kinds of motion are visible: something waves, something flows along a path, something works.',
		reason:
			'Neighbors never move in step. The city is an ecosystem with a time axis, realized as design rules and not as a simulation. At least one sculpture stands as a landmark outside the center.',
		decided: '2026-11-19'
	},
	{
		id: 'CITY-10',
		page: 'city',
		title: 'Sponge city is visible',
		rule: 'The sponge city shows as built elements in the picture, not as a hidden value.',
		reason:
			'Rain, storage and green are part of the cityscape. The elements come from the inventory of the reference images.',
		decided: '2026-11-19',
		demo: { route: '/', anchor: 'schwamm', label: 'Rain stays in the district' }
	}
];

const forms: DesignPrinciple[] = [
	{
		id: 'FORM-1',
		page: 'forms',
		title: 'Solid and void',
		rule: 'A house takes shape through the interplay of occupied cells and spaces left open or cut out of the same 3D grid.',
		reason:
			'Occupied regions form the body and open regions read as courtyards, passages and openings. Target: proven separately in the City Game volume prototype (tessellated storeys, VOLUME-VERIFICATION) and the Lab Voronoi lattice; the shared library has no 3D grid yet (ST6 #36).',
		decided: '2026-11-21',
		demo: { route: '/formen', anchor: 'volume-section', label: 'Read the solid and the passage' }
	},
	{
		id: 'FORM-2',
		page: 'forms',
		title: 'Sculpture, not building',
		rule: 'Forms are large, expressive and sculptural: scaffold with guests, ceramic and Memphis volumes, punched round and arched openings, no ornament.',
		reason:
			'White rounded houses with window bands and cornices read as tame 1930s modernism and were rejected. A form is never steered toward the calm or the well-behaved.',
		decided: '2026-11-18',
		demo: { route: '/sandbox/stile', label: 'Style variants side by side' }
	},
	{
		id: 'FORM-3',
		page: 'forms',
		title: 'References guide the finish',
		rule: 'Once the grid and occupied volume set the building form, house references guide its surfaces, texture, transparency, grilles, scaffolds, light and details.',
		reason:
			'A reference can suggest how a membrane wraps a volume or how a frame filters light. The same occupied and open spaces can support several treatments.',
		decided: '2026-11-21',
		demo: { route: '/material', anchor: 'material-familien', label: 'Compare surface treatments' }
	},
	{
		id: 'FORM-4',
		page: 'forms',
		title: 'Ensembles, not rows',
		rule: 'New houses snap together into ensembles of one to three connected masses with bridges between them, never into rows of blocks.',
		reason:
			'Architecture connects horizontally and vertically into coherent volumes. Fragmentation into many small parts is the fault to avoid; the big picture comes before detail.',
		decided: '2026-11-19',
		demo: { route: '/formen', label: 'Five structures build on the same city' }
	},
	{
		id: 'FORM-5',
		page: 'forms',
		title: 'Everything is joined',
		rule: 'At every contact of two parts sits a visible connector (collar, node, flange or web); the in-between is as important as the elements.',
		reason:
			'Parts that only lie next to or on top of each other look placed, not built. Connectors are derived from the contact graph, never modeled by hand, and take the color of the flow that runs through them.',
		decided: '2026-11-19'
	},
	{
		id: 'FORM-6',
		page: 'forms',
		title: 'Stroke width is force',
		rule: 'The main structure is drawn strong along edges, boundaries and the rims of spaces, secondary members as hairlines; thicker members visibly carry more.',
		reason:
			'The structural family must be readable in the bare frame, not as a primitive in a rectangular bay. Leaving a member out is a deliberate rule too.',
		decided: '2026-11-19',
		demo: { route: '/formen', label: 'Structural systems' }
	},
	{
		id: 'FORM-7',
		page: 'forms',
		title: 'A ladder is never structure',
		rule: 'A ladder is a guest of the frame and never carries it.',
		reason:
			'Plinths and founded frame nodes reach the terrain themselves. A ladder that stands in for a column lies about the load path.',
		decided: '2026-11-20'
	},
	{
		id: 'FORM-8',
		page: 'forms',
		title: 'Nestled into the land',
		rule: 'Architecture nestles into the landscape: no trays on stilts.',
		reason:
			'A building takes its levels from the terrain it stands on; plinths and frame feet reach the ground.',
		decided: '2026-11-20'
	},
	{
		id: 'FORM-9',
		page: 'forms',
		title: 'The same house rule across cells',
		rule: 'A house rule takes its geometry from the shared 3D grid and fits orthogonal, corner, irregular and distorted cells alike.',
		reason:
			'Irregular cells reach the house rule as quads (GRID-1); the brush itself stays quad-only (GRID-4). Target: proven separately in the City Game volume prototype (tessellated storeys) and the Lab Voronoi lattice; the shared library has no 3D grid yet (ST6 #36).',
		decided: '2026-11-21',
		demo: { route: '/sandbox/regel', label: 'One house rule on several 2D grids' }
	},
	{
		id: 'FORM-10',
		page: 'forms',
		title: 'Construction phases',
		rule: 'New construction follows Memphis, then Archigram and Fuller, then organic structures, while earlier buildings remain visible as stock.',
		reason:
			'The phases change chiefly the surfaces and colors of the same house grammar. An early building becomes recognizable stock when the next phase builds around it.',
		decided: '2026-11-21',
		demo: {
			route: '/formen',
			anchor: 'construction-phases',
			label: 'Follow one building through three phases'
		}
	},
	{
		id: 'FORM-11',
		page: 'forms',
		title: 'People are scale figures',
		rule: 'People are tiny, simple, stylized scale figures: neutral silhouette, no faces, no color clutter.',
		reason:
			'Assets drift away from the design language when they are built from a prompt alone. Every asset group is built from a named reference image.',
		decided: '2026-11-19'
	}
];

const grid: DesignPrinciple[] = [
	{
		id: 'GRID-1',
		page: 'grid',
		title: 'Everything ends in quads',
		rule: 'Every grid ends in quads: an n-gon becomes n quads through its center and its edge midpoints.',
		reason:
			'A concave ring is triangulated first, and each triangle gives three quads. Every block edge gets the same number of divisions; then the mesh relaxes and its quality is checked. The grid looks organic through free block polygons, not through odd cells.',
		decided: '2026-11-18',
		demo: { route: '/raster', anchor: 'raster-vierecke', label: 'Every polygon becomes quads' }
	},
	{
		id: 'GRID-2',
		page: 'grid',
		title: 'Terrain and the 3D envelope',
		rule: 'The contour-led ground grid and its 3D cells bound building volume, morphing, overhangs and ordinary access, with individual connections allowed to leave the grid as exceptions.',
		reason:
			'Along the terrain, long grid lines follow contours and cross lines run downslope; bodies may occupy part of their cells and paths may weave between them. Target: proven separately in the City Game volume prototype (tessellated storeys) and the Lab Voronoi lattice; the shared library has no 3D grid yet (ST6 #36).',
		decided: '2026-11-21',
		demo: {
			route: '/raster',
			anchor: 'spatial-grid',
			label: 'Read the envelope and its open square'
		}
	},
	{
		id: 'GRID-3',
		page: 'grid',
		title: 'Terrain changes by building',
		rule: 'Terrain changes only through a deliberate, visible structure (harbor basin, cut, terrace, dam), and the grid is derived anew around it.',
		reason:
			'The grid is a function of terrain and seed and is never stored. Painted things hang on stable anchors, and cells that disappear do so visibly: their parts go back to the material store.',
		decided: '2026-11-18'
	},
	{
		id: 'GRID-4',
		page: 'grid',
		title: 'Odd cells extend the core',
		rule: 'Cells with three to five corners are allowed only as an extension of the universal grid core, never as parallel code.',
		reason:
			'The path of the bible is used first and then extended on purpose. The house brush stays with quads.',
		decided: '2026-11-18',
		demo: { route: '/raster', anchor: 'raster-spielraum', label: 'The mesh moves, the rules stay' }
	},
	{
		id: 'GRID-5',
		page: 'grid',
		title: 'Never fall back to squares',
		rule: 'Everything works on every grid, from the checkerboard to the free organic plan.',
		reason:
			'The data model is a deterministic graph with local rules; rendering is only a projection. A feature that works on squares alone is not finished.',
		decided: '2026-11-11',
		demo: { route: '/raster', anchor: 'raster-grund', label: 'The city stands on any ground' }
	},
	{
		id: 'GRID-6',
		page: 'grid',
		title: 'Seeded city volume',
		rule: 'Terrain produces a seed-regenerable city plan, a 3D spatial grid above it, and subgrids with simple surface bodies extendable by the growth rules.',
		reason:
			'The shared library supplies the geometry, and the bible grid demo shows spatial structure and growth. Target for the first shared acceptance image (ST6 #36).',
		decided: '2026-11-21',
		demo: {
			route: '/raster',
			anchor: 'court-growth',
			label: 'Compare two dates at the same square'
		}
	}
];

const growth: DesignPrinciple[] = [
	{
		id: 'GROW-1',
		page: 'growth',
		title: 'Evolution instead of plan',
		rule: 'The city grows through events over time, never from a master plan.',
		reason:
			'Drivers change (politics, climate, floods, migration), people adapt, and architecture reflects it: conversion, densification, extension, vacancy, and demolition only through a deliberate intervention (CITY-4) or a visible terrain change (GRID-3). The same event principle drives past epochs and the future, at every scale.',
		decided: '2026-11-12',
		demo: { route: '/wachstum', anchor: 'wachstum-wege', label: 'Paths first, then blocks' }
	},
	{
		id: 'GROW-2',
		page: 'growth',
		title: 'What is built stays',
		rule: 'In ordinary time steps, existing buildings stay standing and new work connects to them.',
		reason:
			'The same view and seed show continuity across time steps. A future goal such as the sponge city changes subsequent construction. A deliberate path intervention follows CITY-4.',
		decided: '2026-11-21',
		demo: {
			route: '/raster',
			anchor: 'court-growth',
			label: 'Compare two dates at the same square'
		}
	},
	{
		id: 'GROW-3',
		page: 'growth',
		title: 'Age is a state',
		rule: 'New and stock are states on one time axis, not two classes.',
		reason:
			'The build year sits on the smallest part: module, storey, extension or infrastructure segment. A time step never turns every new house into stock at once.',
		decided: '2026-11-18'
	},
	{
		id: 'GROW-4',
		page: 'growth',
		title: 'A small town to start',
		rule: 'A game opens on a small seeded stock town that can be grayed out.',
		reason:
			'The player is architect and planner on one large canvas. The full time-lapse of an old town is a later project.',
		decided: '2026-11-18'
	}
];

const color: DesignPrinciple[] = [
	{
		id: 'COLOR-1',
		page: 'color',
		title: 'One palette',
		rule: 'One palette serves web, world, HUD and diagrams; a flow is a role mapped onto its tokens, never a color of its own.',
		reason: 'Depth comes from material, not from extra hues.',
		decided: '2026-11-11',
		demo: { route: '/farben', anchor: 'farbe-ruhig', label: 'One color, one function' }
	},
	{
		id: 'COLOR-2',
		page: 'color',
		title: 'Five flows',
		rule: 'Five flows carry color: people, water, energy, food and material.',
		reason:
			'Circularity is not a flow, because every flow runs in a loop. Recovered material belongs to the material flow, and blueprint is the accent for what is planned.',
		decided: '2026-11-12',
		demo: { route: '/farben', anchor: 'farbe-stroeme', label: 'Five flows, five steps' }
	},
	{
		id: 'COLOR-3',
		page: 'color',
		title: 'Pink is for paths',
		rule: 'Pink belongs to paths and people: walkways, stairs and bridges carry it, houses never do.',
		reason:
			'Paths stay opaque pink in every view. The accent of living maps to the lavender of living instead.',
		decided: '2026-11-13'
	},
	{
		id: 'COLOR-4',
		page: 'color',
		title: 'Memphis colors',
		rule: 'Color is bold and poppy: strong use colors and patterns sit on whole bodies and on functional parts.',
		reason:
			'A calm reference for form or light is never read as a palette order; steering houses toward white or muted tones was a mistake and was reverted. The palette stays curated: no realism, no toy clutter.',
		decided: '2026-11-20'
	},
	{
		id: 'COLOR-5',
		page: 'color',
		title: 'Stock as a mix of volume and drawing',
		rule: 'Existing stock carries no use color and mixes two drawings: some buildings are plain light volumes, others detailed pencil drawings, while only the new and the focused flow carry color.',
		reason:
			'The mix reduces detail and still keeps the city lively. A muted phase tint and a pencil line read almost alike, so a building may show either; its construction phase (FORM-10) stays legible through form and drawn detail, not through color.',
		decided: '2026-11-21'
	},
	{
		id: 'COLOR-6',
		page: 'color',
		title: 'One focus for everything',
		rule: 'Every subsystem offers the same display levels (full, silhouette, transparent, pencil, hidden), so one focus view switches the whole city.',
		reason:
			'Focus is a design requirement: the system strips detail so that the player sees one thing.',
		decided: '2026-11-18'
	},
	{
		id: 'COLOR-7',
		page: 'color',
		title: 'Analysis is the one exception',
		rule: 'The analysis view of force distribution is the only place where color does not mean use.',
		reason:
			'It reads like a result plot with scale and legend, and it is switched on, never mixed into the normal view.',
		decided: '2026-11-13'
	}
];

const material: DesignPrinciple[] = [
	{
		id: 'MAT-1',
		page: 'material',
		title: 'Objects carry no color',
		rule: 'A 3D object carries no color: it emits role slots such as ground, accent, frame, hardware, glazing, cloth, bank and path.',
		reason:
			'The engine assigns the palette when the object is built, from use, ensemble and theme. Geometry contains no hex value, no rgb value and no pigment name.',
		decided: '2026-11-19'
	},
	{
		id: 'MAT-2',
		page: 'material',
		title: 'Printed, not transparent',
		rule: 'Where two color fields overlap, a third, darker field with a hard edge appears; shadows are halftone dots.',
		reason: 'The picture reads as a print, not as glass.',
		decided: '2026-11-19'
	},
	{
		id: 'MAT-3',
		page: 'material',
		title: 'Glaze and terrazzo, no photo texture',
		rule: 'A new house shows a glazed or terrazzo surface in a use color, and every surface also sits on curved forms.',
		reason:
			'The level to reach is terrazzo, wood, acrylic and perforated metal under soft light with contact shading. The look is stylized and design-focused: no photo texture, no naturalism.',
		decided: '2026-11-19',
		demo: { route: '/material', anchor: 'material-familien', label: 'Material picker' }
	},
	{
		id: 'MAT-4',
		page: 'material',
		title: 'Guiding style',
		rule: 'The new is a graphic architectural rendering with fine dark outlines, and the structure is the darkest line.',
		reason:
			'A tidy, uncluttered look takes priority. Signal, room tone, camera and density form a spectrum by zoom, task and mode; they follow one inner logic with invariants that are never broken, not blanket rules.',
		decided: '2026-11-13'
	},
	{
		id: 'MAT-5',
		page: 'material',
		title: 'Two quality levels, one system',
		rule: 'A full level for a strong GPU and a light level for phones show the same scene in the same design language.',
		reason:
			'The light level saves on motion, shadow and detail. The levels are parameters, never a second code path.',
		decided: '2026-11-19'
	}
];

const ui: DesignPrinciple[] = [
	{
		id: 'UI-1',
		page: 'interface',
		title: 'Minimal HUD',
		rule: 'The HUD is minimal: flat blocks, hairlines, the typography of the bible, one color focus and one action per view.',
		reason:
			'Opulent interface drafts drift into a generic look. The HUD of the bible page is the template for every draft.',
		decided: '2026-11-16',
		demo: {
			route: '/interface',
			anchor: 'interface-hud',
			label: 'Playing and planning share one image'
		}
	},
	{
		id: 'UI-2',
		page: 'interface',
		title: 'Angular and drawn',
		rule: 'Interface graphics are drawn pen axonometry with faceted geometry and dusty pastel fills: no neon, no glow, no glossy 3D.',
		reason: 'The hard-edged quality is the character; showy 3D loses it.',
		decided: '2026-11-17'
	},
	{
		id: 'UI-3',
		page: 'interface',
		title: 'Lead demo, then single demos',
		rule: 'Every bible page opens with one combined lead demo, followed by small demos of one aspect each, all in the same viewer.',
		reason:
			'A demo starts still. Play and Stop are the only controls, Stop returns to the start state, and only one demo runs per page.',
		decided: '2026-11-17'
	}
];

const library: DesignPrinciple[] = [
	{
		id: 'LIB-1',
		page: 'library',
		title: 'One library for bible and game',
		rule: 'Every bible miniature and the game use the same engine and library with no bible-only or game-only code path, while the game adds controls and actions across the landscape.',
		reason:
			'Each miniature isolates one visible rule, combining direct building with simple city functions; priority goes to visible neighborhoods, paths, bridges, pipes, power connections and transparency (D7). Target: fixtures authored for a single picture are labelled as bible studies and listed on /archiv#library-path until replaced (ST6 #36, ST12 #37, ST14 #38, ST15 #39).',
		decided: '2026-11-21',
		demo: { route: '/interface', anchor: 'engine-path', label: 'Trace the shared path' }
	},
	{
		id: 'LIB-2',
		page: 'library',
		title: 'One object contract',
		rule: 'Every object (asset, design object, house body, primitive) has the same contract: role slots, footprint and anchors in meters, one build signature.',
		reason:
			'The house grammar places objects from one registry by their anchors. No object bakes color into its geometry.',
		decided: '2026-11-19'
	},
	{
		id: 'LIB-3',
		page: 'library',
		title: 'Parameters, not constants',
		rule: 'Library functions take style sets, display levels, grid sizes, proportions and material recipes as data with defaults that can be overridden.',
		reason:
			'Bible and game call the same functions with different parameters. Nothing that defines a look is hard-coded.',
		decided: '2026-11-18'
	},
	{
		id: 'LIB-4',
		page: 'library',
		title: 'Core below, systems above',
		rule: 'A core of independent functions sits at the bottom, specialized libraries on top; dependencies point downward only.',
		reason:
			'The parts combine like bricks. Game logic stays in the headless city library, not in the design system.',
		decided: '2026-11-18'
	},
	{
		id: 'LIB-5',
		page: 'library',
		title: 'WebGPU and TSL',
		rule: 'The 3D world renders with the three.js WebGPURenderer, and every shader and material is written in TSL.',
		reason: 'No GLSL. Performance is measured on a real GPU, never on a software renderer.',
		decided: '2026-11-19'
	},
	{
		id: 'LIB-6',
		page: 'library',
		title: 'Computation never blocks the game',
		rule: 'Expensive computation never blocks the game: it is precomputed in development or runs in a worker with a time budget and a cache.',
		reason:
			'Form follows from simulated force flow, but the player never waits for it. The cache key is a hash of the input.',
		decided: '2026-11-13'
	},
	{
		id: 'LIB-7',
		page: 'library',
		title: 'A kit with its own documentation',
		rule: 'The engine is a kit of small composable building blocks, each with a public entry, documented parameters and a live example on the library documentation page, and every bible demo is assembled from these blocks.',
		reason:
			'The library works like component kits such as shadcn, daisyUI or Babylon Lite: a block is picked, configured and combined, never copied into a page. A demo that starts its own renderer, camera or geometry breaks the kit and LIB-1.',
		decided: '2026-11-21'
	},
	{
		id: 'LIB-8',
		page: 'library',
		title: 'One engine, every view',
		rule: 'Every bible picture is an interactive view of the shared engine: isometric, plan, schematic, section and terrain views are camera and display modes of one scene, never a separately drawn diagram.',
		reason:
			'A plan with contour lines, a section with the coarse envelope, a height-zone envelope over the massing and a dark plan with a time line all show the same city state. The engine owns these modes so the bible, the game and its analysis views stay one picture that the reader can turn, step and switch.',
		decided: '2026-11-21'
	}
];

/** All principles in reading order: page by page, then by number. */
export const designPrinciples: readonly DesignPrinciple[] = [
	...city,
	...forms,
	...grid,
	...growth,
	...color,
	...material,
	...ui,
	...library
];

/**
 * Principles of one bible page in register order.
 * @param page Page that owns the principles.
 * @returns A new array on every call; the entries are the shared, read-only register objects.
 *   Empty when the page owns none.
 */
export function principlesFor(page: PrinciplePage): DesignPrinciple[] {
	return designPrinciples.filter((principle) => principle.page === page);
}
