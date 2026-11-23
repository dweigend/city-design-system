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
	| '/city'
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
		rule: 'Routes share one movement graph, land lanes follow grid edges, and a bridge may span straight between its plan-grid bank nodes when its addressed edge chain falls short of the straightness threshold.',
		reason:
			'Typed ports connect walkways, stairs, ramps and rails with length, slope, capacity and mode. Bridge heads join the banks at grid nodes. Deliberate path placement may open a passage or gate through occupied space or remove a small building.',
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
	},
	{
		id: 'CITY-11',
		page: 'city',
		title: 'An invented valley',
		rule: 'Every city grows in a generated valley whose ground shapes the hills, routes runoff into tributaries and sets lake levels at the lowest outlets.',
		reason:
			'Real cities such as Cologne serve only as test cases for measurement. The same principles take a settlement from its first houses to a metropolis, so every seed tells its own history. Water stays level in a lake and falls along its outlet. Discharge widens the river from around 30 m in the headwaters to 100–150 m in lowland valleys at standard runoff.',
		decided: '2026-11-23'
	},
	{
		id: 'CITY-12',
		page: 'city',
		title: 'Size sets the skyline',
		rule: 'A settlement takes its districts from its built-up area: a village below 1 km² has only two-storey houses, a town adds six-storey blocks, and only a city of several square kilometres grows a high-rise center whose peak rises with its size and falls off in steps.',
		reason:
			'The nominal peak reaches 105 m at 8 km². Neighboring district heights differ by at most six storeys, and a narrow center can peak lower. Columns meet the terrain at their corners and rise to common 7 m roof planes. Body-centered hubs also meet the ground at their own sampled elevations.',
		decided: '2026-11-23'
	},
	{
		id: 'CITY-13',
		page: 'city',
		title: 'Lobed growth on dry ground',
		rule: 'The plan grid continues over rivers, tributaries and lakes, with buildings on dry cells and growth reaching the other bank through candidate crossings that favor shorter spans.',
		reason:
			'Corridors start at crossing heads, bend with the terrain, and take their own bearings and lengths on each bank. Large isolated areas can support satellites. A wet cell center reserves the whole cell for water. A dry center can keep the buildable part of its cell up to the bank setback. Denser districts take the most accessible ground first.',
		decided: '2026-11-23',
		demo: { route: '/city', label: 'Grow a city across the valley' }
	},
	{
		id: 'CITY-14',
		page: 'city',
		title: 'Taper only from afar',
		rule: 'The city envelope retreats above its lower neighbours or overhangs them as one continuous deformation that appears only where zooming out hides member detail and is zero at quarter zoom.',
		reason:
			'Up close the lattice shows true, upright columns; from afar, where members can no longer be read anyway, the taper gives the skyline its gesture. Each corner moves up to 5 m per level above its lowest neighbour, capped so no column folds over. One signed Taper value runs from 1 (retreat) through 0 to −1 (overhang) and applies to every lattice model.',
		decided: '2026-11-23',
		demo: { route: '/city', label: 'Zoom out with Taper' }
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
			'Long grid lines follow contours and cross lines run downslope. Near water, the plan bends toward the shoreline while keeping its cells and adjacency. Bodies can occupy part of a cell and paths can weave between them. Target: proven separately in the City Game volume prototype (tessellated storeys) and the Lab Voronoi lattice; the shared library has no 3D grid yet (ST6 #36).',
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
	},
	{
		id: 'GRID-7',
		page: 'grid',
		title: 'Every cell is a spanned space',
		rule: 'Every cell of the 3D city grid is a spanned space, a polyhedron such as a tetrahedron, hexahedron, octahedron, pyramid, dodecahedron or icosahedron, holding exactly one filling: empty, a bridge or connection, or a house.',
		reason:
			'The spanned space appears already when the city is generated, not as a special object. Paths, bridges and houses are fillings of the same cells, so the principle returns wherever the city builds.',
		decided: '2026-11-21'
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
			'The player is architect and planner on one large canvas. The story line plays the time-lapse before it, from the first settlement in the valley to the game start in 2030.',
		decided: '2026-11-21'
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
		rule: 'Existing stock carries no use color and mixes two drawings: most bodies are plain light see-through volumes, about one in six a pencil drawing, while only the new and the focused flow carry color.',
		reason:
			'The mix reduces detail and still keeps the city lively. Which body is drawn is a seeded draw per plot, so it never changes with the focus or the zoom. A muted phase tint and a pencil line read almost alike, so a building may show either; its construction phase (FORM-10) stays legible through form and drawn detail, not through color.',
		decided: '2026-11-23'
	},
	{
		id: 'COLOR-6',
		page: 'color',
		title: 'One focus for everything',
		rule: 'Every subsystem offers the same display levels (full, silhouette, transparent, pencil, hidden), so one focus view switches the whole city.',
		reason:
			'Focus is a design requirement: the system strips detail so that the player sees one thing. The city need not be drawn completely: out of focus a house may be simplified, greyed out or shown only as a box. One focus choice sets the level of every subsystem from one table; switching it rebuilds no geometry, and a new subsystem joins as a row of that table.',
		decided: '2026-11-23',
		demo: { route: '/city', label: 'Focus selector' }
	},
	{
		id: 'COLOR-7',
		page: 'color',
		title: 'Analytical colour',
		rule: 'Analysis views use a labelled scale whose colours remain distinct from the surrounding layers.',
		reason:
			'Force has its own analysis view. The city height view uses an opaque warm scale from 0 to 140 m, distinct from the blue river and lake surfaces in both themes, so the same column height reads alike in every settlement.',
		decided: '2026-11-13'
	},
	{
		id: 'COLOR-8',
		page: 'color',
		title: 'Transparency mode shows infrastructure',
		rule: 'A transparency mode turns every house into a strongly stylized, gray or black-and-white, see-through body, so pipes, cables, paths and flows stand out in color.',
		reason:
			'Infrastructure is hidden in the normal view, so the city may wear a freer color world there, always from one curated, stylized palette. Use colors carry their meaning on the infrastructure that the transparency mode reveals.',
		decided: '2026-11-21'
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
	},
	{
		id: 'MAT-6',
		page: 'material',
		title: 'Depth in the line drawing',
		rule: 'Lines hidden behind a nearer surface and distant lines are lighter and thinner than near ones, secondary members are lighter than primary ones, and the stepped silhouette is the strongest line of a structure.',
		reason:
			'A dense lattice drawn with one line weight turns into black scribble. Weight by visibility, distance and rank lets a large city read as a stepped mass with structure; a translucent body in front still lets the subject behind it show, subdued.',
		decided: '2026-11-23',
		demo: { route: '/city', label: 'Lattice focus' }
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
	},
	{
		id: 'UI-4',
		page: 'interface',
		title: 'Every page tells its own story',
		rule: 'A bible page carries no cross-reference blocks, link lists or "see chapter" notes; at most a term in the running text links on, as in an encyclopedia.',
		reason:
			'References scatter the reader and make a page depend on others. Each page explains what it shows by itself; the site navigation leads from chapter to chapter.',
		decided: '2026-11-21'
	}
];

const library: DesignPrinciple[] = [
	{
		id: 'LIB-2',
		page: 'library',
		title: 'Geometry uses slots',
		rule: 'Geometry names slots and scene assigns color and material at one boundary.',
		reason: 'The same shape can take different materials without rebuilding its geometry.',
		decided: '2026-11-22'
	},
	{
		id: 'LIB-4',
		page: 'library',
		title: 'Dependencies point downward',
		rule: 'Routes can use any layer, UI stays within its own layer, and the scene, world, domain and core layers depend only on their own layer or the layers below them.',
		reason:
			'Scene projects, world composes, domain defines capabilities and core provides the foundation. Each layer can change without depending on its callers.',
		decided: '2026-11-22'
	},
	{
		id: 'LIB-7',
		page: 'library',
		title: 'One entry per module',
		rule: 'Every module exposes named exports through its index.ts and keeps its other files private to the module.',
		reason:
			'A consumer can configure or combine a module through the same documented entry used by its test and fixed-input example.',
		decided: '2026-11-22'
	},
	{
		id: 'LIB-8',
		page: 'library',
		title: 'One shared stage',
		rule: 'Only the stage creates renderers, cameras and frame loops.',
		reason: 'Plan, terrain, section, schematic and isometric views use the same stage.',
		decided: '2026-11-22'
	},
	{
		id: 'LIB-10',
		page: 'library',
		title: 'Acyclic dependencies',
		rule: 'Files and module folders form graphs without cycles.',
		reason:
			'A cycle can exist between folders even when no individual file imports back into itself.',
		decided: '2026-11-22'
	},
	{
		id: 'LIB-11',
		page: 'library',
		title: 'Headless model',
		rule: 'Core, domain and world run in Bun without the DOM, Svelte, Bits UI, Lucide or three.js.',
		reason: 'Geometry, rules and composition can be tested without a browser or renderer.',
		decided: '2026-11-22'
	},
	{
		id: 'LIB-12',
		page: 'library',
		title: 'Small domain modules',
		rule: 'A domain module imports at most three other domain modules, with wider composition in world.',
		reason: 'A capability stays focused while world combines capabilities into a complete model.',
		decided: '2026-11-22'
	},
	{
		id: 'LIB-13',
		page: 'library',
		title: 'One stylesheet',
		rule: 'All CSS lives in src/app.css and Svelte files use classes without style blocks, inline style attributes or style directives.',
		reason: 'The bible and game share a single place for styles.',
		decided: '2026-11-22'
	},
	{
		id: 'LIB-14',
		page: 'library',
		title: 'Controls from the kit',
		rule: 'Raw buttons, inputs, selects and textareas belong in the UI kit, which owns all Bits UI and Lucide imports.',
		reason: 'Pages and demos reuse the same controls and their interaction behavior.',
		decided: '2026-11-22'
	},
	{
		id: 'LIB-15',
		page: 'library',
		title: 'Routes own page content',
		rule: 'Routes own chapter text and page-local widgets, the library cannot import routes and only scene imports three.js.',
		reason: 'Pages assemble library modules. Scene owns the renderer-facing code.',
		decided: '2026-11-22'
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
