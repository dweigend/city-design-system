import type { Uebertragung } from './uebertragung';

/**
 * Design archive: collected drafts and views for the shared design language.
 * Images live under static/img/; the classification for each image is kept here.
 */

/** What the image shows: scale or type of view. */
export type DesignView =
	| 'welt'
	| 'stadt'
	| 'quartier'
	| 'gebaeude'
	| 'detail'
	| 'karte'
	| 'ui'
	| 'diagramm'
	| 'stimmung'
	| 'inspiration';

/** How close the image is to the shared design language. */
export type DesignFit = 'kern' | 'nah' | 'abweichend' | 'offen';

export type Design = Partial<Uebertragung> & {
	/** Running number, two digits, also the file prefix. */
	id: string;
	/** File name under static/img/. */
	file: string;
	/** Explicit origin for our own replacement images; otherwise the historical number range applies. */
	eigen?: boolean;
	title: string;
	/** Date added (ISO date). */
	added: string;
	view: DesignView;
	/** Design language of the image in keywords, e.g. "isometric, line, watercolor". */
	style: string[];
	fit: DesignFit;
	/** What the image shows and what it stands for (from the narrative). */
	description: string;
	/** What we adopt into the shared design language. */
	keep?: string[];
	/** What does not fit or has to be unified. */
	differs?: string[];
	/** Notes for the procedural world and the three.js implementation. */
	procedural?: string[];
	tags?: string[];
	/** Source, if known (tool, origin, author). */
	source?: string;
};

export const viewLabels: Record<DesignView, string> = {
	welt: 'World',
	stadt: 'City',
	quartier: 'District',
	gebaeude: 'Building',
	detail: 'Detail',
	karte: 'Map',
	ui: 'Interface',
	diagramm: 'Diagram',
	stimmung: 'Mood',
	inspiration: 'Inspiration'
};

export const fitLabels: Record<DesignFit, string> = {
	kern: 'Core',
	nah: 'Close',
	abweichend: 'Divergent',
	offen: 'Open'
};

export const designs: Design[] = [
	{
		id: '01',
		file: 'own-001-district-master-plan-zone.webp',
		title: 'Master Plan Zone 04',
		added: '2026-11-11',
		view: 'quartier',
		style: ['Isometric', 'Ink line', 'Watercolor', 'muted colors'],
		fit: 'nah',
		description:
			'Center of a district: two stacked megacomplexes that combine housing, work, commerce and roof gardens, plus organic white buildings, greenhouse domes, an elevated railway and tube connections. Watercourses and shore zones structure the terrain; forest and sand surround the center. A title block ("SECTOR · MASTERPLAN · ZONE_04") frames the image.',
		keep: [
			'Mixed use within the block: stacked modules in blue, red and orange, planted terraces',
			'Greenhouse domes as a recurring sign of urban farming',
			'Water as a shaping element (sponge city), shores instead of hard edges',
			'Title block with sector and zone as a UI frame'
		],
		differs: [
			'Warmer, more saturated greens and watercolor forest than in 03 and 05',
			'The bridge at lower left reads like a street or footbridge: make it unmistakably a footpath'
		],
		procedural: [
			'Stack complexes from cube modules, roof surfaces as garden slots',
			'Tubes and elevated railway as splines between nodes',
			'Forest as scattered spherical crowns in two to three greens'
		],
		tags: ['Mixed use', 'Urban farming', 'Sponge city', 'Elevated railway', 'Title block']
	},
	{
		id: '02',
		file: 'own-002-city-coastal-panorama.webp',
		title: 'Coastal City Panorama',
		added: '2026-11-11',
		view: 'stadt',
		style: ['Oblique view', 'Fine line', 'Pastel', 'Pink and green'],
		fit: 'abweichend',
		description:
			'A wide overview of an entire coastal city: planted terraced buildings, high-rises, domes, harbors, beaches, rivers and large parks. It shows the scale of the city and the transition from a dense center to green edges.',
		keep: [
			'City scale: center, residential districts, green corridors and coast at a glance',
			'Pink buildings with green roofs as a calm base palette',
			'Parks and green corridors between the districts'
		],
		differs: [
			'Wide streets and highway interchanges contradict the no-streets concept: reinterpret them as elevated railways and footpaths',
			'Perspective oblique view instead of isometric',
			'Glass tower forms depart from the modular form language'
		],
		procedural: [
			'Derive the city boundary from the coastline and river network',
			'A density gradient from center to edge controls building height and share of green'
		],
		tags: ['Overview', 'Coast', 'Green corridor', 'Density']
	},
	{
		id: '03',
		file: 'own-003-district-pastel-isometric.webp',
		title: 'Pastel District',
		added: '2026-11-11',
		view: 'quartier',
		style: ['Isometric', 'Fine line', 'Pastel', 'Stippling'],
		fit: 'kern',
		description:
			'The same district as 01 in a lighter, calmer version: pastel pink paths and squares, modular residential towers made of rounded capsules, an elevated railway, domes, a beach with red umbrellas. People and boats show the scale.',
		keep: [
			'Pink surfaces as public pedestrian and square infrastructure',
			'Red only as a small accent (umbrellas, pavilions, tower crowns)',
			'Rounded capsule modules as a stackable housing unit',
			'Stippling for sand and terrain instead of flat color'
		],
		differs: ['Hardly any differences; the forest is sparser here than in 01'],
		procedural: [
			'Residential towers as stacks of two to three capsule types with random offset',
			'Path network as a pink surface on the terrain, stairs as a tile of their own',
			'Small red objects scattered along shores and squares'
		],
		tags: ['Footpaths', 'Capsule modules', 'Beach', 'Elevated railway', 'Reference district']
	},
	{
		id: '04',
		file: 'own-004-ui-metabolic-village-hud.webp',
		title: 'Metabolic Village with HUD',
		added: '2026-11-11',
		view: 'ui',
		style: ['Isometric', 'Ink line', 'Bold primary colors', 'Plan grid'],
		fit: 'nah',
		description:
			'Game view in build mode: a riverside district with a promenade, grand stairway and beach, overlaid by a HUD with a title block ("LEVEL 01 // ZONE_B // DATA", "CONSTRUCT // METABOLIC_VILLAGE"), coordinates, scale bars, population, status and a toolbar of isometric building icons.',
		keep: [
			'HUD in a monospace font with slash paths as location labels',
			'Toolbar of isometric line icons, active tool framed',
			'Coordinates and metrics (population, status) in the corners',
			'Plan grid with axis labels (A_05, B_12) beneath the scene'
		],
		differs: [
			'Building colors bolder (blue, orange, red) than in 03',
			'Water as wave hatching instead of a flat surface'
		],
		procedural: [
			'Generate the grid with axis labels directly from the world grid',
			'Promenade as a band along the shore, grand stairway as the transition to the water'
		],
		tags: ['HUD', 'Toolbar', 'Build mode', 'Promenade', 'Grid']
	},
	{
		id: '05',
		file: 'own-005-detail-elevated-railway.webp',
		title: 'Circular Detail: Elevated Railway',
		added: '2026-11-11',
		view: 'detail',
		style: ['Isometric', 'Fine line', 'Pastel', 'Pink and green'],
		fit: 'nah',
		description:
			'A circular crop: pink elevated rail lines cross a green district with terraced towers, a ring building, a harbor and a beach. Organic, rounded high-rises with planted balcony bands.',
		keep: [
			'Pink rail lines as the network of public infrastructure',
			'Circular crop as a magnifier or detail view in the game',
			'Planted balcony bands as a facade motif'
		],
		differs: [
			'Streamlined towers instead of modular cubes',
			'Glass blocks at upper right feel foreign to the rest of the form language'
		],
		procedural: [
			'Rail lines as elevated splines with supports at a fixed spacing',
			'Circular mask as a camera or magnifier mode in three.js'
		],
		tags: ['Elevated railway', 'Magnifier', 'Facade greenery', 'Harbor']
	},
	{
		id: '06',
		file: 'own-006-building-concrete-cluster-bridges.webp',
		title: 'Concrete Cluster with Bridges',
		added: '2026-11-11',
		view: 'gebaeude',
		style: ['3D render', 'Concrete', 'Wood', 'Steel frame', 'Color accent'],
		fit: 'kern',
		description:
			'A building cluster of concrete cylinders and towers, topped with white boxes with solar roofs, timber modules and turquoise steel frames. Tubes connect the boxes; an orange and a blue bridge lead inside as footpaths. Ring-shaped roof gardens.',
		keep: [
			'Brutalist core (concrete) plus light modules (timber, white box)',
			'Exterior tubes and frames as at the Centre Pompidou',
			'Colored pedestrian bridges as circulation instead of streets',
			'Solar surfaces and planter rings as visible cycles'
		],
		differs: ['Photorealistic materials: reduce them for the game'],
		procedural: [
			'Core from a cylinder or tower, modules docked onto it via cantilevers',
			'Bridges as a spline between circulation points, color by function',
			'Roof types as a slot: solar, garden, terrace'
		],
		tags: ['Brutalism', 'Pompidou', 'Timber construction', 'Circulation', 'Solar']
	},
	{
		id: '07',
		file: 'own-007-building-color-cluster-stairs.webp',
		title: 'Color Cluster with Stairs',
		added: '2026-11-11',
		view: 'gebaeude',
		style: ['3D render', 'Memphis', 'Orange · Yellow · Green', 'White'],
		fit: 'nah',
		description:
			'A white building volume with docked boxes in orange, yellow and green, bridges between the towers, spiral stairs, railings in green and blue, awnings.',
		keep: [
			'Color as a code for modules or functions on a white base volume',
			'Spiral stairs and exterior bridges as circulation',
			'Thin railing lines as a graphic element'
		],
		differs: ['No green on the roofs, which makes it feel less sustainable'],
		procedural: ['Color assignment per module type, base volume always neutral'],
		tags: ['Memphis', 'Color code', 'Stairs']
	},
	{
		id: '08',
		file: 'own-008-ui-book-page-modules.webp',
		title: 'Book Page: Modules and Infrastructure',
		added: '2026-11-11',
		view: 'ui',
		style: ['Editorial', '3D render', 'Isometric', 'Red · Blue · White'],
		fit: 'kern',
		description:
			'Spread "The Metabolic City Builder · 04 / Modules & Infrastructure": grotesque headline, body text, sketches, and on the right a module tower with labels (Pod Type-B, Module v.08, Terramorphic Roof, Place Module) and a narrow toolbar (Build, Erase, Tube, Destroy) with coordinates.',
		keep: [
			'Editorial layout as a model for the design bible itself',
			'Labels with hairlines and module names in capitals',
			'Status lines ("System Status: Active", "Grid Aligned")',
			'Vertical toolbar with four core tools'
		],
		differs: ['Rendered 3D instead of drawing as in 01 to 05'],
		procedural: [
			'Name and version module types (Pod, Place, Roof)',
			'Tower as a stack of platforms with pods'
		],
		tags: ['Editorial', 'Labeling', 'Toolbar', 'Modules']
	},
	{
		id: '09',
		file: 'own-009-district-square-primary-forms.webp',
		title: 'Square of Primary Forms',
		added: '2026-11-11',
		view: 'quartier',
		style: ['3D render', 'Bauhaus', 'Primary forms', 'Material mix'],
		fit: 'nah',
		description:
			'A square on a gray slab with basic forms: sphere, quarter circle, tube, cube stack, cone, gold polyhedron, concrete with a perforated grille, yellow timber houses with roof trees, a pond and voxel trees.',
		keep: [
			'Primary forms as a construction kit: cube, cylinder, sphere, cone, arch',
			'Voxel trees as simple, procedural vegetation',
			'Slab as a game board tile'
		],
		differs: [
			'Gold and mirror polyhedra are very idiosyncratic',
			'Reads more like a sculpture park than a city'
		],
		procedural: [
			'Form library of primitives maps directly to three.js',
			'Trees as cube stacks with variation in height'
		],
		tags: ['Bauhaus', 'Primary forms', 'Voxel', 'Square']
	},
	{
		id: '10',
		file: 'own-010-building-industrial-collage.webp',
		title: 'Industrial Building Collage',
		added: '2026-11-11',
		view: 'gebaeude',
		style: ['3D render', 'Memphis', 'Industrial', 'Material collage'],
		fit: 'nah',
		description:
			'A converted concrete industrial hall with a light blue sawtooth roof, a dark blue tower with portholes and a tank, yellow stairs, a cork box on a column, a black-and-white striped structure, a wavy edge.',
		keep: [
			'Adaptive reuse of industrial buildings as a stance',
			'Memphis patterns (stripes, wave) as a facade accent',
			'Cork and concrete as a material pair'
		],
		differs: ['Rusty steel wall is very realistic'],
		procedural: ['Patterns as a texture set: stripes, wave, dots, terrazzo'],
		tags: ['Industrial', 'Memphis', 'Adaptive reuse', 'Pattern']
	},
	{
		id: '11',
		file: 'own-011-district-wooden-model.webp',
		title: 'Wooden Model District',
		added: '2026-11-11',
		view: 'quartier',
		style: ['3D render', 'Model making', 'Wood', 'Pastel and primary'],
		fit: 'abweichend',
		description:
			'A district with a model-making look: a blue and a red high-rise, pastel houses with wooden roofs, exterior stairs, a bridge, dot patterns, wooden cone and ball trees.',
		keep: [
			'Model-making feel (wood, cardboard) as a friendly reading',
			'Cone and ball trees as vegetation',
			'Exterior stairs and skybridge'
		],
		differs: [
			'Gray streets between the blocks contradict the no-streets concept',
			'Gabled roofs are rather conventional'
		],
		procedural: [
			'Trees from two primitives (cone, ball on a stick)',
			'Blocks as tiles with a path edge'
		],
		tags: ['Model making', 'Wood', 'Vegetation']
	},
	{
		id: '12',
		file: 'own-012-building-blue-house-cork.webp',
		title: 'Blue House with Cork',
		added: '2026-11-11',
		view: 'gebaeude',
		style: ['3D render', 'Memphis', 'Cobalt blue', 'Cork'],
		fit: 'nah',
		description:
			'A low, cobalt blue house of offset cubes with recessed roof surfaces, a cork cube with a striped lid, a red circle and an orange canopy.',
		keep: [
			'One base color per building plus one contrasting material',
			'Circle and canopy as mini accents',
			'Roof edges as upstands, flat roof usable'
		],
		differs: ['No greenery, no visible function'],
		procedural: ['Floor plan from offset rectangles plus a semicircle'],
		tags: ['Memphis', 'Cork', 'Single color']
	},
	{
		id: '14',
		file: 'own-014-district-material-city-grid.webp',
		title: 'Material City on a Grid',
		added: '2026-11-11',
		view: 'quartier',
		style: ['3D render', 'Isometric', 'Material textures', 'Terrazzo · Marble'],
		fit: 'abweichend',
		description:
			'A grid of residential blocks with wild surfaces: terrazzo, marble, paint splatter, sponge yellow, concrete, glass, dripping paint. Small trees and people on white squares.',
		keep: [
			'Material as the identity of individual buildings',
			'White square surfaces, trees and people as a sense of scale'
		],
		differs: ['Grid streets contradict the concept', 'Textures too loud for an entire district'],
		procedural: ['Materials as a shader set, used sparingly (one outlier per block)'],
		tags: ['Material', 'Texture', 'Grid']
	},
	{
		id: '15',
		file: 'own-015-detail-form-sculpture-lattice.webp',
		title: 'Form Sculpture with Lattice',
		added: '2026-11-11',
		view: 'detail',
		style: ['3D render', 'Memphis', 'Toy', 'Material mix'],
		fit: 'nah',
		description:
			'A sculpture of building blocks: a yellow wedge with studs, a black lattice cube with a red ball, a blue wave, a terrazzo cylinder, particleboard, concrete with a crack pattern, a spring and wave stairs.',
		keep: [
			'Form vocabulary: wedge, lattice, wave, spring, tube, studs',
			'Particleboard and terrazzo as materials',
			'Lattice cube as a frame or void'
		],
		differs: ['Toy scale, not architecture'],
		procedural: [
			'Form vocabulary as a library of small parts for building crowns and rooftop structures'
		],
		tags: ['Form vocabulary', 'Memphis', 'Material']
	},
	{
		id: '16',
		file: 'own-016-building-pastel-acrylic-envelope.webp',
		title: 'Pastel Acrylic Envelope',
		added: '2026-11-11',
		view: 'gebaeude',
		style: ['3D render', 'Pastel', 'Transparency', 'Model'],
		fit: 'offen',
		description:
			'A pink building volume with inserted boxes in blue, purple, green and yellow, covered by an acrylic glass envelope with slanted supports and a slide.',
		keep: [
			'Transparent envelope as a climate skin or greenhouse idea',
			'Inserted boxes as room-within-a-room'
		],
		differs: [
			'Pastel instead of primary colors',
			'Transparency in large amounts is expensive to render'
		],
		procedural: ['Envelope as a semitransparent material with edge lines'],
		tags: ['Transparency', 'Room within a room', 'Pastel']
	},
	{
		id: '17',
		file: 'own-017-mood-utopian-tower-collage.webp',
		title: 'Utopian Tower Collage',
		added: '2026-11-11',
		view: 'stimmung',
		style: ['Collage', 'Utopia', 'Pastel', 'Archigram'],
		fit: 'abweichend',
		description:
			'A vertical city as a collage: stacked platforms with rocks, pools, half-pipes, climbing walls, stairs, inflatable tubes, roof gardens, people. Mountains and spheres in the background.',
		keep: [
			'Utopian stance like Archigram and Superstudio: leisure, nature and housing stacked',
			'Inflatable elements (Ant Farm)',
			'Many people bring the building to life'
		],
		differs: ['Cars and a street at lower left', 'Collage style instead of a unified rendering'],
		procedural: ['Vertical stacking of platforms with programs (pool, garden, sports)'],
		tags: ['Utopia', 'Archigram', 'Ant Farm', 'Vertical']
	},
	{
		id: '18',
		file: 'own-018-building-block-tower.webp',
		title: 'Building Block Tower',
		added: '2026-11-11',
		view: 'gebaeude',
		style: ['3D render', 'Building blocks', 'Primary colors', 'Material mix'],
		fit: 'kern',
		description:
			'A tower of building blocks: concrete, terrazzo, particleboard, a yellow studded roof, a blue cone, a red porthole, a black lattice frame, yellow stairs, a spiral tree.',
		keep: [
			'Buildings as a stack of clear blocks: ideal for procedural generation',
			'Cone and porthole as crown and identifying mark',
			'Spiral tree as a playful element'
		],
		procedural: [
			'Grammar: plinth, stack, crown; block size on the grid',
			'Roll materials and colors from a limited palette'
		],
		tags: ['Building blocks', 'Grammar', 'Procedural']
	},
	{
		id: '19',
		file: 'own-019-building-appliance-house-ring.webp',
		title: 'Appliance House with Ring',
		added: '2026-11-11',
		view: 'gebaeude',
		style: ['3D render', 'Industrial design', 'Light gray · Orange · Yellow'],
		fit: 'kern',
		description:
			'A light gray, appliance-like building that resembles an electrical device: perforated grid, yellow drawers, an orange ring, an orange speaker module, a turquoise circle, small stairs.',
		keep: [
			'Industrial design (Braun, Rams) as a form language: appliance instead of house',
			'Perforated grids and slots as facade details',
			'A few color accents on light gray'
		],
		procedural: ['Details as decals: perforated grid, slots, circles'],
		tags: ['Industrial design', 'Appliance', 'Accent']
	},
	{
		id: '20',
		file: 'own-020-building-appliance-house-hood.webp',
		title: 'Appliance House with Hood',
		added: '2026-11-11',
		view: 'gebaeude',
		style: ['3D render', 'Industrial design', 'White · Orange · Yellow · Blue'],
		fit: 'kern',
		description:
			'A white, screwed-together housing with a yellow drawer, an orange perforated-metal hood and a blue disc on the roof.',
		keep: [
			'Screws and joints make modules legible',
			'Hood and drawer as functional modules (ventilation, storage)',
			'Reduction to a few parts'
		],
		procedural: ['Functional modules as interchangeable parts at fixed docking points'],
		tags: ['Industrial design', 'Module', 'Reduction']
	},
	{
		id: '21',
		file: 'own-021-building-sphere-houses-tubes.webp',
		title: 'Sphere Houses with Tubes',
		added: '2026-11-11',
		view: 'gebaeude',
		style: ['3D render', "'60s utopia", 'Capsules', 'Colorful'],
		fit: 'nah',
		description:
			'Sphere and capsule houses in cream, red, yellow and turquoise on concrete cylinders, connected by tubes and footbridges, spiral stairs, antennas.',
		keep: [
			"Capsule and Futuro houses as housing modules (Metabolism, '60s)",
			'Tubes as enclosed connecting routes',
			'Concrete core as the carrier'
		],
		differs: ['Hardly any green'],
		procedural: ['Cores as cylinders, attach capsules radially, tubes as connections'],
		tags: ['Capsule', 'Metabolism', 'Futuro', 'Tube']
	},
	{
		id: '22',
		file: 'own-022-building-memphis-tower.webp',
		title: 'Memphis Tower',
		added: '2026-11-11',
		view: 'gebaeude',
		style: ['3D render', 'Memphis', 'Postmodernism', 'Colorful'],
		fit: 'nah',
		description:
			'A postmodern tower of blocks, each with its own color and pattern: a green perforated block, a blue hat, a wooden ball, a stepped gable, orange arches, graphic panels in red and yellow.',
		keep: [
			'Each block its own pattern, together one building',
			'Arches and hats as Memphis quotations'
		],
		differs: ['Very dense and loud, only as a landmark'],
		procedural: ['Landmark mode: higher variance in color and pattern'],
		tags: ['Memphis', 'Landmark', 'Postmodernism']
	},
	{
		id: '23',
		file: 'own-023-detail-form-sculpture-spring.webp',
		title: 'Form Sculpture with Spring',
		added: '2026-11-11',
		view: 'detail',
		style: ['3D render', 'Memphis', 'Toy', 'Material mix'],
		fit: 'nah',
		description:
			'A variant of 15: a blue wave box, yellow springs, a studded wedge, a lattice cube with balls, a terrazzo column, concrete blocks with arches, paper trees.',
		keep: ['Springs and pipes as connecting parts', 'Paper trees (honeycomb paper) as vegetation'],
		differs: ['Toy scale'],
		procedural: ['Connectors (spring, pipe) between blocks as a separate class of parts'],
		tags: ['Form vocabulary', 'Connector', 'Vegetation']
	},
	{
		id: '24',
		file: 'own-024-building-glazed-house.webp',
		title: 'Glazed House',
		added: '2026-11-11',
		view: 'gebaeude',
		style: ['3D render', 'Ceramics', 'Pastel', 'Glaze'],
		fit: 'offen',
		description:
			'A house of blocks in pastel and wood, topped with a roof in orange and blue ceramic glaze, a blue hat with an antenna, a golden ball, a cactus, stairs and an arch.',
		keep: ['Ceramics and glaze as a material idea', 'Arch and stairs as basic elements'],
		differs: ['Glaze gradient is hard to stylize', 'Gold feels foreign'],
		procedural: ['Glaze as a gradient shader only for special buildings'],
		tags: ['Ceramics', 'Glaze', 'Special building']
	},
	{
		id: '25',
		file: 'own-025-ui-metabolic-grid-hud.webp',
		title: 'Metabolic Grid with HUD',
		added: '2026-11-11',
		view: 'ui',
		style: ['Isometric', 'Fine line', 'Monochrome with pastel', 'Plan grid'],
		fit: 'kern',
		description:
			'Game view "The Metabolic Grid // v.05": an almost monochrome line drawing of the district from 01, with only the central complex in pastel colors. Labels with hairlines (Module Type B, HAB-64, Transit_Link), crosshairs, a status line, scale bars, coordinates and, at the bottom, the toolbar from 04.',
		keep: [
			'Focus through color: selection in color, surroundings only as line',
			'Labels as part of the game world',
			'HUD bar identical to 04: it becomes the standard',
			'Plan grid as the ground'
		],
		procedural: [
			'Two render modes: line (context) and color (focus), switchable per object',
			'Labels as 3D-anchored hairlines with screen text'
		],
		tags: ['HUD', 'Focus', 'Labeling', 'Line mode']
	},
	{
		id: '26',
		file: 'own-026-diagram-module-sheet-four.webp',
		title: 'Module Sheet: Four Modules',
		added: '2026-11-11',
		view: 'diagramm',
		style: ['Architectural drawing', 'Axonometric', 'Dimensioning', 'Yellow · Blue · Terracotta'],
		fit: 'kern',
		description:
			'A plate with four modules: Cellular Tower (organic cells in a frame), Translucent Conduit (a band of tubes with a balloon and a basin), Tectonic Assembly (arches, bricks, scaffold), Scaffold Matrix (scaffold with platforms and stairs). With dimensions, numbering and figure captions.',
		keep: [
			'Modules as named, numbered families: the basis for the building catalog',
			'Dimensions and figure captions as an editorial style',
			'Organic forms within an orthogonal frame'
		],
		procedural: [
			'Four module families directly as generators: cells, tube, arch building, scaffold',
			'Frame volume as the building site, infill procedural'
		],
		tags: ['Module families', 'Dimensioning', 'Editorial']
	},
	{
		id: '27',
		file: 'own-027-diagram-system-drawing.webp',
		title: 'System Drawing',
		added: '2026-11-11',
		view: 'diagramm',
		style: ['Architectural drawing', 'Axonometric', 'Transparency', 'Pastel'],
		fit: 'kern',
		description:
			'A connected system built from the modules of 26: scaffold towers with cells, a glass hall with a garden and small houses, tube transit in loops, domed cells on stilts, water towers, dimensions in grid units (01, 06, 24).',
		keep: [
			'Transparent envelopes reveal the interior: cycles become visible',
			'Tube transit links everything as a pedestrian and transport network',
			'Grid units as dimensions'
		],
		procedural: [
			'Building as a graph: nodes (modules) and edges (tubes)',
			'See-through envelopes with edge lines as a material mode of their own'
		],
		tags: ['System', 'Transparency', 'Tube', 'Grid']
	},
	{
		id: '28',
		file: 'own-028-mood-maximal-collage-island.webp',
		title: 'Maximal Collage: Island',
		added: '2026-11-11',
		view: 'stimmung',
		style: ['Collage', 'Maximalism', 'Pastel and neon', 'Glitch'],
		fit: 'abweichend',
		description:
			'An overflowing collage: a city block full of objects, patterns, textures, tubes and domes, with a small city and rivers below. Glitch pixels, drawing fragments and arrows in the white space.',
		keep: [
			'Stance: the city as an art object, full of ideas',
			'Pastel tubes as flowing connections',
			'Glitch and drawing fragments as editorial ornament'
		],
		differs: ['Far too dense for a playable view', 'No clear scale'],
		procedural: ['Conceivable as a special view or loading screen, not as game graphics'],
		tags: ['Maximalism', 'Collage', 'Glitch']
	},
	{
		id: '29',
		file: 'own-029-mood-maximal-collage-zoom.webp',
		title: 'Maximal Collage with Zoom',
		added: '2026-11-11',
		view: 'stimmung',
		style: ['Collage', 'Maximalism', 'Pastel and neon', 'Detail crops'],
		fit: 'abweichend',
		description:
			'A variant of 28 with zoom boxes ("Zoom in", "Zoom in panel") that pull out details. Domes, ring buildings, tubes, patterns, disintegrating fragments.',
		keep: [
			'Zoom boxes with a line back to the origin as a UI pattern for detail views',
			'Disintegrating fragments as a deconstruction or construction effect'
		],
		differs: ['Density and wealth of color as in 28'],
		procedural: ['Magnifier as UI: a frame plus a connecting line to the object in the world'],
		tags: ['Zoom', 'Detail', 'Collage']
	},
	{
		id: '30',
		file: 'own-030-mood-tube-world-figures.webp',
		title: 'Tube World with Figures',
		added: '2026-11-11',
		view: 'stimmung',
		style: ['Collage', 'Surreal', 'Pastel and neon', 'Tubes'],
		fit: 'abweichend',
		description:
			'A surreal industrial landscape of tubes, scaffolds, conveyor belts and basins, populated by pink figures and statues. Giant berries, tanks, lettering fragments.',
		keep: [
			'Tubes and conveyor belts as visible material cycles',
			'Industry as a walkable landscape'
		],
		differs: ['Figures and statues are very idiosyncratic', 'Collage instead of drawing'],
		procedural: ['Material flows as animated tubes between production modules'],
		tags: ['Cycle', 'Industrial', 'Surreal']
	},
	{
		id: '31',
		file: 'own-031-mood-tube-world-section.webp',
		title: 'Tube World in Section',
		added: '2026-11-11',
		view: 'stimmung',
		style: ['Collage', 'Axonometric', 'Pastel', 'Tubes'],
		fit: 'nah',
		description:
			'A calmer version of 30: conveyor systems, tubes, wind turbines, a geodesic dome, half-pipe buildings, rocks and terrazzo steles on white, with plan and glitch fragments.',
		keep: [
			'Buckminster Fuller dome as a guiding form',
			'Wind turbines and tubes show energy and material cycles',
			'Plenty of white space keeps the density legible'
		],
		differs: ['Still collage-like'],
		procedural: ['Production chain as a spline network with tubes in category colors'],
		tags: ['Cycle', 'Fuller', 'Energy']
	},
	{
		id: '32',
		file: 'own-032-mood-utopian-landscape.webp',
		title: 'Utopian Landscape Panorama',
		added: '2026-11-11',
		view: 'stimmung',
		style: ['Illustration', 'Pastel', 'White space', 'Fictional architecture'],
		fit: 'nah',
		description:
			'A panorama of a utopian leisure and production landscape: a planted scaffold mountain, a dome, polyhedral rocks on a ring, a half-pipe, terraced pools, slides, terrazzo steles, colorful mountains, soap bubbles.',
		keep: [
			'Fictional architecture without a precedent: exactly the ambition we want',
			'Leisure (bathing, climbing, sliding) as part of the city',
			'Pastel mountains as a backdrop'
		],
		differs: ['No grid, free composition'],
		procedural: ['Special buildings as hand-placed landmarks between procedural districts'],
		tags: ['Utopia', 'Landmark', 'Leisure']
	},
	{
		id: '33',
		file: 'own-033-district-insertion-existing-city.webp',
		title: 'Insertion into the Existing City',
		added: '2026-11-11',
		view: 'quartier',
		style: ['Isometric', 'Ink line', 'Color within gray', 'Greenery'],
		fit: 'kern',
		description:
			'A new, colorful district in the middle of a gray existing city (line only): white cubes with roof gardens, a red elevated walkway loop, blue tubes, open steel frames, stairs, plants, people.',
		keep: [
			'Existing stock as line, new additions in color: a clear reading of old and new',
			'Red elevated walkways as a pedestrian network above the buildings',
			'Open frames as space for later modules'
		],
		differs: [
			'Red is used over large areas here (paths), otherwise only as an accent: clarify the role of the path color (cf. pink in 03)'
		],
		procedural: [
			'Line mode also for existing stock or the not-yet-converted city',
			'Elevated walkways as a spline over the roofs'
		],
		tags: ['Existing stock', 'Elevated walkway', 'Conversion', 'Line mode']
	},
	{
		id: '34',
		file: 'own-034-diagram-sponge-city-cycle.webp',
		title: 'Sponge City in Cycle',
		added: '2026-11-11',
		view: 'diagramm',
		style: ['Illustration', 'Axonometric', 'Pastel', 'Cycle icons'],
		fit: 'kern',
		description:
			'An axonometric section through a district with visible cycles: rainwater runs over roof gardens, cascades and basins, a greenhouse, a vertical farm, solar panels, wind turbines, contour lines below. Drops, leaves and clouds as symbols.',
		keep: [
			'Make cycles directly visible (water, energy, food)',
			'Symbols for flows: drop, leaf, wind',
			'Contour lines as the terrain representation'
		],
		procedural: [
			'Water as a particle or spline flow from roof to basin',
			'Cycle overlay mode shows flows with icons'
		],
		tags: ['Sponge city', 'Cycle', 'Overlay', 'Urban farming']
	},
	{
		id: '35',
		file: 'own-035-mood-floating-islands.webp',
		title: 'Floating Islands',
		added: '2026-11-11',
		view: 'stimmung',
		style: ['Montage', 'Black and white', 'Superstudio', 'Surreal'],
		fit: 'offen',
		description:
			'A black-and-white montage in the manner of the utopians: floating islands with trees, cubic megastructures, glass tubes as bridges, spheres with gardens, waterfalls, a tower with city fragments, flying capsules.',
		keep: [
			'Superstudio and Archigram directly: megastructure, tubes, floating gardens',
			'Waterfalls as a water cycle motif'
		],
		differs: ['Black and white and photomontage depart from the color system'],
		procedural: ['A duotone mode is conceivable as a memory or archive view'],
		tags: ['Superstudio', 'Archigram', 'Megastructure', 'Montage']
	},
	{
		id: '36',
		file: 'own-036-district-existing-stock-scaffold.webp',
		title: 'Existing Stock with Scaffold Structures',
		added: '2026-11-11',
		view: 'quartier',
		style: ['Isometric', 'Line', 'Yellow · Blue · Pink', 'Existing stock as line'],
		fit: 'kern',
		description:
			'An old town with gabled houses and arches as gray line only; above and between them new structures in three colors: yellow frames and silos, blue steel scaffolds with escalators, pink stair and housing volumes. Terrain and trees as line.',
		keep: [
			'Existing stock stays as line, extensions in color',
			'Three-color system with roles: yellow structure/silo, blue circulation, pink housing/gathering',
			'The new grows through and over the old'
		],
		procedural: [
			'Existing buildings procedurally as line models, extensions as colored modules at docking points',
			'Color by the role of the module, not by building'
		],
		tags: ['Existing stock', 'Building on existing stock', 'Color roles', 'Scaffold']
	},
	{
		id: '37',
		file: 'own-037-district-rooftop-extension-pink.webp',
		title: 'Rooftop Extension in Pink',
		added: '2026-11-11',
		view: 'quartier',
		style: ['Isometric', 'Line and hatching', 'Pink as single color', 'Gradient'],
		fit: 'kern',
		description:
			'An existing block (gray hatching) with white, transparent rooftop extensions and a pink network of roof terraces, stairs and elevated walkways full of people. Dashed contour lines, background in a gradient from pink to gray.',
		keep: [
			'Pink as the only color marks the public network (cf. 03, 05)',
			'Rooftop extensions as white, semitransparent cubes',
			'Roofs become public squares'
		],
		procedural: [
			'Rooftop extension: white cubes on an existing roof, number set by load capacity',
			'Public network as a layer of its own that connects roofs'
		],
		tags: ['Rooftop extension', 'Densification', 'Public network', 'Roof square']
	},
	{
		id: '38',
		file: 'own-038-district-industrial-heritage.webp',
		title: 'Industrial Heritage with Elevated Walkway',
		added: '2026-11-11',
		view: 'quartier',
		style: ['Isometric', 'Line and hatching', 'Pink as single color', 'Contour lines'],
		fit: 'kern',
		description:
			'Industrial monuments (a factory with chimneys, viaducts, a steel bridge, townhouses) in gray, linked by a pink elevated walkway with stair towers that leads to a new white district of cubes and cylinders.',
		keep: [
			'Viaducts and bridges are reused rather than replaced',
			'Pink elevated walkway connects old and new, stair towers as nodes',
			'New in white, old in gray, connection in color'
		],
		procedural: [
			'Existing infrastructure (viaduct, rail line) as the starting network for elevated walkways',
			'Stair tower as a node module every n cells'
		],
		tags: ['Industrial heritage', 'Elevated walkway', 'Viaduct', 'Building on existing stock']
	},
	{
		id: '39',
		file: 'own-039-district-old-town-utility.webp',
		title: 'Old Town with Utility Network',
		added: '2026-11-11',
		view: 'quartier',
		style: ['Isometric', 'Grayscale', 'Red · Yellow', 'Transparency'],
		fit: 'kern',
		description:
			'Stone towers of old buildings in grayscale, surrounded by transparent new-build volumes. Red levels, stairs and bridges connect the towers; yellow utility lines run as a network on the ground and climb the facades.',
		keep: [
			'Red for walkable extensions, yellow for supply',
			'Utility lines visible and on the outside (Pompidou)',
			'Transparent volumes show planned buildings'
		],
		differs: ['Red over large areas: clashes with red as an accent'],
		procedural: [
			'Supply network as an overlay: utility lines as pipe splines along grid lines',
			'Transparent = planned, opaque = built'
		],
		tags: ['Supply', 'Utility lines', 'Planning', 'Old town']
	},
	{
		id: '40',
		file: 'own-040-diagram-section-underground.webp',
		title: 'Section with Underground',
		added: '2026-11-11',
		view: 'diagramm',
		style: ['Section', 'Line', 'Wood · Concrete · Primary colors', 'Pattern'],
		fit: 'kern',
		description:
			'A vertical section: old houses with vaulted cellars and a tunnel in line, with new towers of concrete, timber and colored panels above and inside them. Utility lines in red, blue and yellow run down into the underground; an elevator shaft, stair cores.',
		keep: [
			'Section as a view of its own: shows the underground, utility lines, existing stock',
			'Cores (stairs, elevator) pierce the existing stock',
			'Timber and concrete as the material pair of the extension'
		],
		procedural: [
			'Section view in three.js via a clipping plane',
			'Underground as a layer for utility lines and storage'
		],
		tags: ['Section', 'Underground', 'Cores', 'Timber construction']
	},
	{
		id: '41',
		file: 'own-041-district-memphis-existing-stock.webp',
		title: 'Memphis on Existing Stock',
		added: '2026-11-11',
		view: 'quartier',
		style: ['3D render', 'Memphis', 'Existing stock as line', 'Pastel and primary'],
		fit: 'kern',
		description:
			'Gray, drawn existing buildings with arches and windows as a plinth; on the roofs, a colorful Memphis city of cubes, cylinders, cones, patterns and bridges.',
		keep: [
			'Combines drawing (existing stock) with rendered forms (extension): a possible answer to drawing vs. render',
			'The form vocabulary of 09, 18 and 22 sits on the old building'
		],
		differs: ['Dense Memphis colors, more landmark than district'],
		procedural: [
			'Two material worlds in the same image: line shader for existing stock, color shader for new builds'
		],
		tags: ['Memphis', 'Existing stock', 'Rooftop extension', 'Style mix']
	},
	{
		id: '42',
		file: 'own-042-building-tower-house-red.webp',
		title: 'Tower House with Red Interventions',
		added: '2026-11-11',
		view: 'gebaeude',
		style: ['Isometric', 'Line', 'Red as single color', 'Grid'],
		fit: 'kern',
		description:
			'Stacked old houses on a grid slab as fine line, with red interventions: docked boxes, stairs, balcony bands, a crane arm with a module, supports. Small people and trees.',
		keep: [
			'One color marks the intervention: what is new reads instantly',
			'Interventions dock on without hiding the existing stock',
			'Grid slab as the building site'
		],
		differs: ['Red as intervention color vs. red as accent: define the role'],
		procedural: ['Intervention types: box, stairs, band, crane; each with a docking rule'],
		tags: ['Intervention', 'Existing stock', 'Docking']
	},
	{
		id: '43',
		file: 'own-043-district-old-town-block.webp',
		title: 'Old Town Block with Scaffold',
		added: '2026-11-11',
		view: 'quartier',
		style: ['Isometric', 'Line', 'Red as single color', 'Transparency'],
		fit: 'kern',
		description:
			'A historic block with a dome, a clock tower and townhouses as line, transparent rooftop extensions, a red network of scaffold towers, stairs, bridges, cranes and a cable car.',
		keep: [
			'Scaffold and crane show the construction process as part of the aesthetic',
			'Cable car as transport without streets',
			'Landmarks are preserved'
		],
		procedural: [
			'Construction phases visible: scaffold and crane, then transparent, then finished',
			'Cable car as a line between two towers'
		],
		tags: ['Construction process', 'Scaffold', 'Cable car', 'Old town']
	},
	{
		id: '44',
		file: 'own-044-district-focus-footpaths.webp',
		title: 'Focus: Footpaths',
		added: '2026-11-11',
		view: 'quartier',
		style: ['Isometric', 'Grayscale', 'Pink as single color', 'Transparency'],
		fit: 'kern',
		description:
			'A version of 37 without the roof terrace furnishings: existing stock and rooftop extensions only gray and semitransparent, the public footpath network (stairs, ramps, squares) as the only color. One theme, one hue.',
		keep: [
			'Focus through one color: everything else recedes as gray',
			'Transparent volumes take mass out of the image',
			'Pink = footpaths and public space'
		],
		procedural: ['Focus mode "Paths": network in color, buildings as an envelope at 40 % opacity'],
		tags: ['Focus', 'Footpaths', 'Focus & color code']
	},
	{
		id: '45',
		file: 'own-045-district-three-color-codes.webp',
		title: 'Three Color Codes at Once',
		added: '2026-11-11',
		view: 'quartier',
		style: ['Isometric', 'Grayscale', 'Yellow · Pink · Green', 'Transparency'],
		fit: 'kern',
		description:
			'An old town in gray with semitransparent houses; three color codes at once: yellow elevated walkways, pink housing modules, green farm modules (greenhouses, vertical farm).',
		keep: [
			'Combining several codes works as long as the rest stays gray',
			'Color by role: network, housing, food',
			'Contour lines as a calm ground'
		],
		procedural: ['Up to three focus codes can be combined; existing stock always neutral'],
		tags: ['Focus', 'Combination', 'Urban farming', 'Focus & color code']
	},
	{
		id: '46',
		file: 'own-046-district-focus-old-town.webp',
		title: 'Focus: Old Town Footpaths',
		added: '2026-11-11',
		view: 'quartier',
		style: ['Isometric', 'Grayscale', 'Pink as single color', 'Transparency'],
		fit: 'kern',
		description:
			'Like 44, but with half-timbering, a clock tower and gables in the existing stock; the pink paths and a pink scaffold run through the old town.',
		keep: [
			'Even richly detailed existing stock stays calm when it is gray and transparent',
			'Scaffold in the focus color shows the construction process of the network'
		],
		procedural: ['Level of detail of existing stock selectable independently of focus'],
		tags: ['Focus', 'Old town', 'Footpaths', 'Focus & color code']
	},
	{
		id: '47',
		file: 'own-047-district-tower-two-networks.webp',
		title: 'Tower with Two Networks',
		added: '2026-11-11',
		view: 'quartier',
		style: ['Isometric', 'Line', 'Yellow · Light blue', 'Contour lines'],
		fit: 'kern',
		description:
			'A scaffold tower with yellow modules and a yellow path network, plus light blue utility lines and routes (water or rail). Village-like existing houses and a church only as line with shadows.',
		keep: [
			'Two networks in two colors, clearly separable',
			'Utility lines climb the tower: supply becomes visible',
			'Axis cross and scale as plan elements'
		],
		procedural: ['Networks as spline pipes, color by material flow'],
		tags: ['Focus', 'Networks', 'Water', 'Focus & color code']
	},
	{
		id: '48',
		file: 'own-048-building-orange-modules-white.webp',
		title: 'Orange Modules in a White Structure',
		added: '2026-11-11',
		view: 'gebaeude',
		style: ['3D render', 'White · Transparency', 'Orange as single color'],
		fit: 'kern',
		description:
			'An open building section: a white load-bearing structure with a rooftop farm, greenhouses, offices and a railway, all inserted modules and escalators in orange. Parts of the envelope transparent.',
		keep: [
			'The rule works in the render style too: structure white, focus in one color',
			'Escalators and modules in the same color = the same role'
		],
		procedural: ['Render mode: structure neutral, focus objects in color code'],
		tags: ['Focus', 'Modules', 'Section', 'Focus & color code']
	},
	{
		id: '49',
		file: 'own-049-district-paths-utility-lines.webp',
		title: 'Paths and Utility Lines',
		added: '2026-11-11',
		view: 'quartier',
		style: ['Isometric', 'Grayscale', 'Red · Yellow', 'Transparency'],
		fit: 'kern',
		description:
			'An old town block with transparent new-build volumes, red walkable levels and stairs, a yellow utility network on the ground with nodes. A second version of 39.',
		keep: [
			'Two layers: movement above, supply below',
			'Nodes in the utility network as a form of their own'
		],
		differs: ['Red as path color clashes with Signal'],
		procedural: ['Make the utility network visible at its own height (below the terrain)'],
		tags: ['Focus', 'Utility lines', 'Combination', 'Focus & color code']
	},
	{
		id: '50',
		file: 'own-050-ui-reduced-map-hud.webp',
		title: 'Reduced Map with HUD',
		added: '2026-11-11',
		view: 'ui',
		style: ['Isometric', 'Line', 'Pastel only on buildings', 'Plan grid'],
		fit: 'kern',
		description:
			'Game view "Level 04 // Region_D // Grid_v.01": wide terrain only as contour lines and grid, a few buildings in color (Habitat, Transit-Link), others only as line. HUD with toolbar and coordinates.',
		keep: [
			'A large view stays legible by leaving things out',
			'Colored buildings = active or relevant, line = the rest',
			'Labels only for important objects'
		],
		procedural: ['Wide zoom: terrain only as contour lines, buildings at block or line level'],
		tags: ['HUD', 'Reduction', 'Zoom', 'Focus & color code']
	},
	{
		id: '52',
		eigen: true,
		vorbild: '',
		zweck:
			'Collage technique: cut-out fragments as a library of components, building by combining → Material',
		zentrum: 'Technik',
		file: 'adapt-052-inspiration-components-combine.webp',
		title: 'Components to Combine',
		added: '2026-11-11',
		view: 'inspiration',
		style: ['Cutout', 'Black and white', 'Collage'],
		fit: 'nah',
		description:
			'Original rendering: our components (scaffold nodes, capsule shells, footbridge pieces, rain tanks and salvaged old-building windows) laid out as a plate from which a house can be assembled.',
		keep: [
			'Industrial parts as a component library',
			'Rods and stilts as a recurring motif',
			'Collage of fragments = building by combining'
		],
		procedural: ['Parts library: every fragment as a combinable module'],
		tags: ['Cutout', 'Industrial', 'Library'],
		source: 'Eigenes Artwork'
	},
	{
		id: '53',
		eigen: true,
		vorbild: '',
		zweck: 'Typology plate as a rendering technique: many variants of one rule set → Lab / Growth',
		zentrum: 'Technik',
		file: 'adapt-053-inspiration-house-variants-scaffold.webp',
		title: 'House Variants in the Scaffold',
		added: '2026-11-11',
		view: 'inspiration',
		style: ['Grayscale', 'Axonometric', 'Typology'],
		fit: 'nah',
		description:
			'Original rendering: generator output, forty capsule-in-scaffold variants from one seed sequence, without color, as evidence for "one rule set, many houses".',
		keep: [
			'Typology plate as a way to show variants of a generator',
			'Grayscale as the block level of detail'
		],
		procedural: ['Show generator output as a plate: many variants, one rule set'],
		tags: ['Typology', 'Variants', 'Generator'],
		source: 'Eigenes Artwork'
	},
	{
		id: '55',
		eigen: true,
		vorbild: '',
		zweck:
			'Technique/color rule: existing stock in grayscale, intervention as one flat signal color → City #weiterbauen, Color',
		zentrum: 'Technik',
		file: 'adapt-055-inspiration-building-existing-stock.webp',
		title: 'Building on Existing Stock',
		added: '2026-11-11',
		view: 'inspiration',
		style: ['Pencil', 'Grayscale', 'Signal color'],
		fit: 'kern',
		description:
			'Original rendering: our own pencil axonometric of a dense existing city, with only the new scaffolds, capsules and elevated walkways as flat signal surfaces on top.',
		keep: [
			'Existing stock as a grayscale photo, intervention as a flat signal color',
			'The most extreme form of the focus rule: one hue against everything'
		],
		procedural: [
			'Wide zoom: existing stock as a grayscale texture, interventions as flat color volumes'
		],
		tags: ['Rooftop extension', 'Existing stock', 'Focus', 'Architectural visualization'],
		source: 'Eigenes Artwork'
	},
	{
		id: '56',
		eigen: true,
		vorbild: '',
		zweck:
			'Walking distance principle: nodes, edges and radii as an overlay → City #hochwege, Interface (overlay)',
		zentrum: 'Prinzip',
		file: 'adapt-056-diagram-walking-distance.webp',
		title: 'Walking Distance in the District',
		added: '2026-11-11',
		view: 'diagramm',
		style: ['Map', 'Line', 'Flow color'],
		fit: 'kern',
		description:
			'Original rendering: our own district plan without streets, elevated walkway nodes as areas in the People flow color, walking radii as thin circles.',
		keep: [
			'Radii as a representation of the 15-minute city',
			'Nodes and edges as a network overlay',
			'Asterisks as a simple place symbol'
		],
		procedural: ['"Accessibility" overlay: circles around nodes in steps 1 to 2 of the flow color'],
		tags: ['Radius', '15-minute', 'Network', 'Architectural visualization'],
		source: 'Eigenes Artwork'
	},
	{
		id: '58',
		eigen: true,
		vorbild: '',
		zweck:
			'Callout UI layout: black label boxes with a pointer on a white model, yellow for community → Interface',
		zentrum: 'UI-Layout',
		file: 'adapt-058-diagram-district-place-labels.webp',
		title: 'District with Place Labels',
		added: '2026-11-11',
		view: 'diagramm',
		style: ['Axonometric', 'White model', 'Black labels'],
		fit: 'kern',
		description:
			"Original rendering: our own white model of a scaffold district with labels for rain catchment, rooftop farm, elevated walkway and workshop yard, set with the Bible's Bits UI tag.",
		keep: [
			'Black label boxes with a pointer as a callout component',
			'Yellow for public and shared space',
			'White model as context'
		],
		procedural: ['Labels on 3D anchors, box in ink, text in paper'],
		tags: ['Label', 'Callout', 'Community', 'Architectural visualization'],
		source: 'Eigenes Artwork'
	},
	{
		id: '65',
		eigen: true,
		vorbild: '',
		zweck:
			'Plug-in principle: capsules hang in a pole scaffold, ladders provide access, the silhouette sprawls → Forms, House',
		zentrum: 'Prinzip',
		file: 'adapt-065-inspiration-capsules-scaffold.webp',
		title: 'Capsules in the Scaffold',
		added: '2026-11-11',
		view: 'inspiration',
		style: ['Line', 'Hatching'],
		fit: 'kern',
		description:
			'Original rendering: our scaffold with three to five capsules of different sizes, one of them just hanging from the crane, ladders and footbridges as circulation, in line with sparing hatching.',
		keep: [
			'Plug-in: capsules hang in a structural system',
			'Scaffold and ladder as circulation',
			'A growing, irregular silhouette'
		],
		procedural: ['Scaffold as a grid, capsules occupy nodes at random, ladders connect'],
		tags: ['Plug-in', 'Capsule', 'Scaffold', 'Utopia'],
		source: 'Eigenes Artwork'
	},
	{
		id: '67',
		eigen: true,
		vorbild: 'Buckminster Fuller, Fly’s Eye Dome and Dymaxion Car',
		zweck:
			'Fuller architectural style: geodesic dome with portholes → Forms (structural family: dome)',
		zentrum: 'Stil',
		file: 'adapt-067-inspiration-dome-existing-roof.webp',
		title: 'Dome on an Existing Roof',
		added: '2026-11-11',
		view: 'inspiration',
		style: ['Line drawing', 'Dome', 'Greenhouse'],
		fit: 'kern',
		description:
			'Original rendering: our dome from the structural family as a greenhouse on an existing roof, with a figure on the elevated walkway in front.',
		keep: ['Geodesic dome as a guiding form (Fuller)', 'Circular openings as a facade motif'],
		procedural: ['Dome from icosahedron subdivision, openings per face'],
		tags: ['Fuller', 'Dome', 'Geodesy', 'Utopia'],
		source: 'Eigenes Artwork'
	},
	{
		id: '69',
		eigen: true,
		vorbild: 'probably Haus-Rucker-Co, Gelbes Herz',
		zweck:
			'Haus-Rucker-Co/pneumatic architectural style: light, temporary, see-through → Forms (envelope)',
		zentrum: 'Stil',
		file: 'adapt-069-inspiration-pneumatic-structure.webp',
		title: 'Pneumatic Structure over the Courtyard',
		added: '2026-11-11',
		view: 'inspiration',
		style: ['Line drawing', 'Transparent', 'Pastel'],
		fit: 'nah',
		description:
			'Original rendering: a temporary pneumatic room hanging from a scaffold bay above the courtyard, as a festival hall or shelter during construction, in our palette instead of yellow-orange.',
		keep: [
			'Pneumatic structure as light, temporary architecture',
			'Transparency shows the people inside',
			'Yellow and orange as pneumatic colors'
		],
		procedural: ['Pneumatic module: soft, inflated geometry, semitransparent'],
		tags: ['Pneumatic', 'Transparency', 'Temporary', 'Utopia'],
		source: 'Eigenes Artwork'
	},
	{
		id: '74',
		eigen: true,
		vorbild: 'Archigram, Free Time Node: Trailer Cage',
		zweck:
			'Archigram collage style: megastructure as a shelf for mobile units → City (stance), Forms',
		zentrum: 'Stil',
		file: 'adapt-074-inspiration-city-shelf.webp',
		title: 'City Shelf above the Existing Stock',
		added: '2026-11-11',
		view: 'inspiration',
		style: ['Collage', 'Scaffold', 'Pastel'],
		fit: 'nah',
		description:
			'Original rendering: our scaffold as a shelf for capsules, a rooftop farm and a workshop above an old-building plinth, an elevated walkway instead of a ramp; the lead image for the stance.',
		keep: [
			'Megastructure as a shelf for mobile units',
			'Collage of existing stock, scaffold and interchangeable units'
		],
		procedural: ['Shelf megastructure with interchangeable units'],
		tags: ['Megastructure', 'Plug-in', 'Archigram', 'Utopia'],
		source: 'Eigenes Artwork'
	},
	{
		id: '84',
		eigen: true,
		vorbild: '',
		zweck:
			'Principle of building on existing stock: an exploded view shows new floor slabs and a core in the old building; existing stock as line, intervention in color → City #weiterbauen, House',
		zentrum: 'Prinzip',
		file: 'adapt-084-diagram-layers-old-building.webp',
		title: 'New Layers in an Old Building',
		added: '2026-11-11',
		view: 'diagramm',
		style: ['Exploded view', 'Pencil', 'System colors'],
		fit: 'kern',
		description:
			'Original rendering: an existing house from the game world as a pencil shell at the top, with our scaffold, floor slabs and circulation core floating below in system colors.',
		keep: [
			'The exploded view shows what is newly inserted into the existing stock',
			'Core (blue) as a continuous element',
			'Existing stock at the top as line, intervention in color'
		],
		procedural: ['Exploded view: pull floors apart along the vertical axis'],
		tags: ['Exploded view', 'Existing stock', 'Core', 'Vertical'],
		source: 'Eigenes Artwork'
	},
	{
		id: '85',
		eigen: true,
		vorbild: '',
		zweck:
			'Self-sufficiency principle: sun and rain cloud as inflow symbols, greenhouse floors in the residential tower → House, City (claim)',
		zentrum: 'Prinzip',
		file: 'adapt-085-building-farm-cycles.webp',
		title: 'Farm and Cycles',
		added: '2026-11-11',
		view: 'gebaeude',
		style: ['Line', 'Cycle', 'Flow colors'],
		fit: 'kern',
		description:
			'Original rendering: a frame tower built from our scaffold with a farm floor, rain catchment and a tank, inflows as lines in the Energy and Water flow colors, figures for scale.',
		keep: [
			'Sun and cloud as symbols for inflows',
			'Greenhouse floors in the residential tower',
			'Stripes as a Memphis accent'
		],
		procedural: ['Inflows as dashed lines from symbols to the building'],
		tags: ['Cycle', 'Greenhouse', 'Symbols', 'Vertical'],
		source: 'Eigenes Artwork'
	},
	{
		id: '86',
		eigen: true,
		vorbild: '',
		zweck:
			'UI layout: exploded tower, numbered and named levels, one ramp through all of them → Interface (floor panel), House',
		zentrum: 'UI-Layout',
		file: 'adapt-086-diagram-courtyard-rooftop-farm.webp',
		title: 'From Courtyard to Rooftop Farm',
		added: '2026-11-11',
		view: 'diagramm',
		style: ['Exploded view', 'Isometric', 'Numbering'],
		fit: 'kern',
		description:
			"Original rendering: a house from the game world from 00 Courtyard to 05 Rooftop Farm, the elevated walkway as a continuous band, text set in the Bible's type grid.",
		keep: [
			'Numbered, named levels: a template for the floor panel',
			'One color per level as the floor',
			'A continuous ramp as the route through the house'
		],
		procedural: ['Floor list in the UI, synchronized with the exploded view'],
		tags: ['Levels', 'Exploded view', 'Program', 'Vertical'],
		source: 'Eigenes Artwork'
	},
	{
		id: '87',
		eigen: true,
		vorbild: '',
		zweck:
			'Principle of the vertical water cycle: water drips from slab to slab, a color spot marks the function → City #schwamm',
		zentrum: 'Prinzip',
		file: 'adapt-087-diagram-water-layers-house.webp',
		title: 'Water through the Layers of a House',
		added: '2026-11-11',
		view: 'diagramm',
		style: ['Ink drawing', 'Water', 'Color spots'],
		fit: 'nah',
		description:
			'Original rendering: an ink drawing of a scaffold house with rain catchment, roof garden, filter bed and cistern stacked on top of each other, with a soft spot in the Water flow color behind each layer.',
		keep: [
			'A color spot behind the layer identifies its function',
			'Water drips from layer to layer: a vertical cycle',
			'A drawn, artistic tone'
		],
		procedural: ['Layer identifier as a soft color spot in exploded mode'],
		tags: ['Layers', 'Cycle', 'Drawing', 'Vertical'],
		source: 'Eigenes Artwork'
	},
	{
		id: '91',
		eigen: true,
		vorbild: '',
		zweck:
			'Densification principle: each volume one use in its own color, neighbors only as line, terraces in between → Color, City #weiterbauen',
		zentrum: 'Prinzip',
		file: 'adapt-091-district-building-corner-lot.webp',
		title: 'Building On at the Corner Lot',
		added: '2026-11-11',
		view: 'quartier',
		style: ['Axonometric', 'Line', 'Flow colors'],
		fit: 'kern',
		description:
			'Original rendering: a leftover lot between pencil-drawn old buildings, with capsules and boxes from our form catalog stacked in the scaffold, one flow color per use, terraces as shared space.',
		keep: [
			'Stacking on a small lot: densification',
			'Each use a volume of its own in its own color',
			'Terraces as public in-between spaces'
		],
		procedural: ['Generator: volume stack from a list of functions, form per function'],
		tags: ['Stack', 'Densification', 'Microcosm', 'Vertical'],
		source: 'Eigenes Artwork'
	},
	{
		id: '93',
		file: 'own-093-ui-city-stack-layers.webp',
		title: 'City Stack: Layers and Drawing Modes',
		added: '2026-11-11',
		view: 'ui',
		style: ['UI sketch', 'Workbench', 'Exploded view'],
		fit: 'offen',
		description:
			'A workbench with a menu, a breadcrumb ("City Stack > Axonometric View"), a form library and five drawing modes on the left (Axonometric Line, Schematic Stack, Exploded View, Layered Transparency, Sketch Line), layer switches on the right (Structure, Program, Circulation, Vistas), sliders for explosion distance and opacity, a site plan as a minimap and a console at the bottom. Center: an exploded tower around a blue core with labeled modules. A functional sketch: the style is not binding.',
		keep: [
			'Drawing modes as switches = levels of representation and building views',
			'Layer switches for structure, program, circulation, sight lines',
			'Sliders for explosion distance and opacity: control the transformation directly',
			'Site plan minimap shows where the house stands in the city',
			'Console as an event log'
		],
		procedural: ['Explosion distance as a continuous parameter, not just on/off'],
		tags: ['Workbench', 'Layers', 'Drawing modes', 'Exploded view', 'UI']
	},
	{
		id: '94',
		file: 'own-094-ui-diagram-builder.webp',
		title: 'Diagram Builder',
		added: '2026-11-11',
		view: 'ui',
		style: ['UI sketch', 'Drawing program', 'Pastel'],
		fit: 'offen',
		description:
			'Drawing program logic: tools on the left (pen, fill, volume, curve, palette, eraser), layers on the right (Sketch, Base Volumes, Fills, Paths, Notes) with visibility and "Art Components" (tree, bench, spiral staircase, facade panel), at the bottom style, layer, scale, composition progress, undo/redo, export. Center: a tower with a pink circulation path and notes. A functional sketch: the style is not binding.',
		keep: [
			'City building as drawing: sketch → volume → fill → paths → notes as layers',
			'Art components as small building blocks (bench, stairs, tree)',
			'Composition progress as a game goal per house',
			'Export as a diagram: the player produces architectural drawings'
		],
		procedural: [
			'Representation layers of a house switchable one by one (sketch, volume, fill, paths)'
		],
		tags: ['Drawing', 'Layers', 'Art components', 'Export', 'UI']
	},
	{
		id: '95',
		file: 'own-095-ui-urban-systems-editor.webp',
		title: 'Urban Systems Editor',
		added: '2026-11-11',
		view: 'ui',
		style: ['UI sketch', 'Data panel', 'Categories'],
		fit: 'offen',
		description:
			'Categories on the left with a line icon and color swatches in steps (Residential, Commercial, Industrial, Parks, Transport Hub, Utilities), in the center a stacked, semitransparent mixed-use block with labels, on the right time series for population, budget, energy and traffic. At the bottom build, demolish, layers, settings. A functional sketch: the style is not binding.',
		keep: [
			'Category legend with an icon and several color steps',
			'Time series as the right-hand column',
			'Transparent stacks show mixed use'
		],
		differs: [
			'"Traffic Flow" and traffic: replace them in the game with people and material flows'
		],
		procedural: ['Feed the metrics column from simulation values'],
		tags: ['Legend', 'Metrics', 'Mixed use', 'UI']
	},
	{
		id: '96',
		file: 'own-096-ui-minimalist-city-editor.webp',
		title: 'Minimalist City Editor',
		added: '2026-11-11',
		view: 'ui',
		style: ['UI sketch', 'Classic city builder', 'Black-and-white frame'],
		fit: 'offen',
		description:
			'A classic city-builder layout: time controls at the top (play, pause, fast-forward), funds, population, satisfaction; on the left a history graph, an event list, a build menu with categories and counters, a legend; at the bottom a building palette; on the right city statistics (water, power, waste). Center: colorful buildings on a street grid. A functional sketch: the style is not binding.',
		keep: [
			'Time controls and a header with three metrics',
			'Build menu with counters per category',
			'Event list (unlocked, expanded)',
			'Statistics table for flows (water, power, waste)'
		],
		differs: [
			'Street grid and cars contradict the concept',
			'Flat instead of vertical: exactly what we want to do differently'
		],
		procedural: ['Use as a counterexample and as a checklist of mandatory elements'],
		tags: ['Classic', 'Time controls', 'Build menu', 'Counterexample', 'UI']
	},
	{
		id: '97',
		file: 'own-097-ui-city-and-stack.webp',
		title: 'City and Stack at Once',
		added: '2026-11-11',
		view: 'ui',
		style: ['UI sketch', 'Isometric', 'Colorful'],
		fit: 'offen',
		description:
			'A city grid with simple buildings and a large, colorful stacked building in the middle. On the right, analysis with curves and two insets: the stack as a detail view and as a section. Tools and city values on the left. A functional sketch: the style is not binding.',
		keep: [
			'Two scales at once: the city in the center, the selected house as an inset',
			'Section inset shows the interior without a scene change'
		],
		differs: ['Streets and factory chimneys'],
		procedural: [
			'Picture-in-picture: a second camera on the selected house, switchable between exterior and section'
		],
		tags: ['Multi-perspective', 'Inset', 'Analysis', 'UI']
	},
	{
		id: '98',
		file: 'own-098-ui-form-palette-grabbing.webp',
		title: 'Form Palette and Grabbing',
		added: '2026-11-11',
		view: 'ui',
		style: ['UI sketch', 'Line', 'Pastel'],
		fit: 'offen',
		description:
			'On the left a vertical palette of basic forms (slope, L, ramp, stairs, wedge, spiral, slab), in the center a core tower with docked modules. A hand grabs a green module; dashed lines show where parts come from or belong. A functional sketch: the style is not binding.',
		keep: [
			'Forms as a palette straight from the library',
			'Grabbing and docking onto the core',
			'Dashed guide lines to the target position'
		],
		procedural: ['Docking points on the core, snapping with a dashed preview'],
		tags: ['Palette', 'Drag', 'Docking', 'Core', 'UI']
	},
	{
		id: '99',
		file: 'own-099-ui-archi-stack-commissions.webp',
		title: 'Archi-Stack with Commissions',
		added: '2026-11-11',
		view: 'ui',
		style: ['UI sketch', 'Blueprint', 'Tablet'],
		fit: 'offen',
		description:
			'A tablet layout in blue: a build palette (grid cube, stair block, void, slanted wall, window, tree), in the center a cutaway house with modules (Living Module D/E, Atrium, Core Elevator). On the right project status, client wishes (3 bedrooms, max. sun), a resource inventory (concrete, glass, wood, steel), a budget with a warning. At the bottom build, select, delete, undo, rotate, zoom. A functional sketch: the style is not binding.',
		keep: [
			"Residents' wishes as a goal per house",
			'Material inventory as part of the cycle',
			'Budget bar with a warning',
			'Touch-friendly basic commands'
		],
		procedural: [
			'Derive demand per house from its residents; material from deconstruction goes into the inventory'
		],
		tags: ['Commissions', 'Inventory', 'Material', 'Tablet', 'UI']
	},
	{
		id: '100',
		file: 'own-100-ui-level-inside-house.webp',
		title: 'A Level inside the House',
		added: '2026-11-11',
		view: 'ui',
		style: ['UI sketch', 'Black and white', 'Red as accent'],
		fit: 'offen',
		description:
			'A minimalist puzzle level: a cutaway house with three levels (atrium, studio, workshop) and a roof terrace, floating building blocks (stairs, Void B-2), figures (user, visitor), dashed walking routes, a red key and a red door. A functional sketch: the style is not binding.',
		keep: [
			'The house as a walkable microcosm with people and routes',
			'Red only for interactive things (key, door, lever)',
			'Levels named and numbered'
		],
		procedural: ["Simulate residents' routes inside the house and show them dashed"],
		tags: ['Microcosm', 'Routes', 'Interaction', 'Level', 'UI']
	},
	{
		id: '101',
		file: 'own-101-ui-construction-palette.webp',
		title: 'Construction Palette',
		added: '2026-11-11',
		view: 'ui',
		style: ['UI sketch', 'Black and white', 'Red'],
		fit: 'offen',
		description:
			'Puzzle building: on the left a vertical form palette with a selection frame, at the top the goal "Secure Red Core", in the center a cutaway house with figures, floating building blocks (Void B-2, ramp) and a red core. A functional sketch: the style is not binding.',
		keep: [
			'Goal card at the upper right',
			'Selected part framed in red in the palette',
			'Red = goal and interaction'
		],
		procedural: ['Goals as states in the house (secure the core, connect a room)'],
		tags: ['Goal', 'Palette', 'Puzzle', 'UI']
	},
	{
		id: '102',
		file: 'own-102-ui-axon-build.webp',
		title: 'Axon Build',
		added: '2026-11-11',
		view: 'ui',
		style: ['UI sketch', 'Cubes', 'Primary colors'],
		fit: 'offen',
		description:
			'Level 12 with a budget and a progress bar: a mountain of cubes in black, white and primary colors; a pink arch form is placed by hand into a green preview cell. At the bottom a tray with limited parts (2/5). A functional sketch: the style is not binding.',
		keep: [
			'Limited parts with a counter: puzzle logic',
			'Green ghost cell as a valid placement',
			'Progress bar as the level goal'
		],
		procedural: ['Valid docking cells as a transparent preview in the success color'],
		tags: ['Puzzle', 'Inventory', 'Preview', 'UI']
	},
	{
		id: '103',
		file: 'own-103-ui-cube-mountain-stairs.webp',
		title: 'Cube Mountain with Stairs',
		added: '2026-11-11',
		view: 'ui',
		style: ['3D render', 'Gray', 'Primary accents'],
		fit: 'offen',
		description:
			'A gray mountain of cubes with stairs, figures, a red quarter cylinder, a striped wall and a yellow cube in a wireframe as the next part. A functional sketch: the style is not binding.',
		keep: ['The wireframe shows the next part', 'Stairs connect the cube levels'],
		procedural: ['Next part as a wire cube next to the scene'],
		tags: ['Cubes', 'Stairs', 'Preview', 'UI']
	},
	{
		id: '104',
		file: 'own-104-ui-volumes-spatial-grid.webp',
		title: 'Volumes in a Spatial Grid',
		added: '2026-11-11',
		view: 'ui',
		style: ['Line', 'Wood', 'Primary colors'],
		fit: 'offen',
		description:
			'Bauhaus volumes in wood, yellow, red and blue with a striped bracket, surrounded by an isometric spatial grid as the building envelope. A functional sketch: the style is not binding.',
		keep: ['The spatial grid makes the buildable space visible', 'Volumes snap into the grid'],
		procedural: ['3D grid as the buildable space, visible only while building'],
		tags: ['Grid', 'Buildable space', 'UI']
	},
	{
		id: '105',
		file: 'own-105-ui-city-actualizer-matrix.webp',
		title: 'City Actualizer: Matrix System',
		added: '2026-11-11',
		view: 'ui',
		style: ['Line', 'Pastel', 'Plan labeling'],
		fit: 'offen',
		description:
			'A pastel megastructure of capsules, tubes and pipes, with plan labels (Phase 02, Modules, Coord, Level 03 Active) and transparent color fields as layers. A functional sketch: the style is not binding.',
		keep: [
			'Layers as transparent color fields behind the structure',
			'The label "Active" for the active layer'
		],
		procedural: ['Back the active layer with a colored field'],
		tags: ['Layers', 'Megastructure', 'UI']
	},
	{
		id: '106',
		file: 'own-106-ui-grid-section-city.webp',
		title: 'Grid Section: City Slab',
		added: '2026-11-11',
		view: 'ui',
		style: ['Line', 'Pastel', 'Plate'],
		fit: 'offen',
		description:
			'A city slab with tubes, domes, towers, checkerboard and stripe patterns, an axial grid along the edge, a legend and a table below. A functional sketch: the style is not binding.',
		keep: ['Plate with axial grid, legend, tables', 'Patterns as building identifiers'],
		procedural: ['Axis labels from world coordinates'],
		tags: ['Plate', 'Grid', 'Legend', 'UI']
	},
	{
		id: '107',
		file: 'own-107-ui-metropolis-matrix-phase.webp',
		title: 'Metropolis Matrix: Phase 2',
		added: '2026-11-11',
		view: 'ui',
		style: ['Line', 'Colorful', 'Planning'],
		fit: 'offen',
		description:
			'Dense city planning from above: blocks in many colors, a red path network, turquoise squares, spherical buildings; on the right a column of building silhouettes as a palette. A functional sketch: the style is not binding.',
		keep: ['Silhouette palette on the right', 'Red network over blocks'],
		differs: ['Red as the network color'],
		procedural: ['Palette of building silhouettes'],
		tags: ['Planning', 'Palette', 'Network', 'UI']
	},
	{
		id: '108',
		file: 'own-108-ui-district-04-metabolic.webp',
		title: 'District 04: Metabolic',
		added: '2026-11-11',
		view: 'ui',
		style: ['3D render', 'White', 'Primary pipes'],
		fit: 'offen',
		description:
			'A white megastructure with yellow, blue and red utility lines, a vertical palette on the right (Pod A, Utility B/C, Connector), a status line with population and energy at the top. A functional sketch: the style is not binding.',
		keep: [
			'Palette with module types (Pod, Utility, Connector)',
			'Colored utility lines on a white building'
		],
		procedural: ['Module type classes: Pod, Utility, Connector'],
		tags: ['Modules', 'Utility lines', 'Palette', 'UI']
	},
	{
		id: '109',
		file: 'own-109-ui-valley-outpost.webp',
		title: 'Valley Outpost',
		added: '2026-11-11',
		view: 'ui',
		style: ['Line', 'Terrain', 'HUD'],
		fit: 'offen',
		description:
			'An almost empty valley of contour lines, two towers and a few buildings linked by a rail line. HUD as in 04 and 25. A functional sketch: the style is not binding.',
		keep: ['Game start in an almost empty landscape (outpost)', 'HUD standard confirmed'],
		differs: ['Starts on a greenfield site, the concept wants existing stock'],
		procedural: ['Wide zoom with terrain as line'],
		tags: ['Start', 'Terrain', 'HUD', 'UI']
	},
	{
		id: '110',
		file: 'own-110-ui-hybrid-construct.webp',
		title: 'Hybrid Construct',
		added: '2026-11-11',
		view: 'ui',
		style: ['Line and render', 'HUD', 'Colorful'],
		fit: 'offen',
		description:
			'In the center a hybrid complex rendered in color, the surroundings only as line; labels (Conduit_Link, Module_09, Terrain), an orange dome, the HUD at the bottom. A functional sketch: the style is not binding.',
		keep: ['Render in focus, line in context: core rule confirmed'],
		procedural: ['Focus layer rendered, context as line'],
		tags: ['Focus', 'Line', 'HUD', 'UI']
	},
	{
		id: '111',
		file: 'own-111-ui-mixed-view-table.webp',
		title: 'Mixed View on the Table',
		added: '2026-11-11',
		view: 'ui',
		style: ['3D render', 'Model table', 'HUD'],
		fit: 'offen',
		description:
			'A model on a wooden table: a megastructure of capsules and tubes, a palette on the left (Grid, Capsule, Conduit, Staircase, Orchard, Transit), metrics on the right (Flow, Capacity), labels with values. A functional sketch: the style is not binding.',
		keep: [
			'The city as a model on the table: framed as an architectural model',
			'Palette with component types incl. Orchard',
			'Metrics as curves and bars'
		],
		procedural: ['Camera option: model table as the frame'],
		tags: ['Model', 'Palette', 'Metrics', 'UI']
	},
	{
		id: '112',
		file: 'own-112-ui-sector-c-mixed.webp',
		title: 'Sector C: Mixed View',
		added: '2026-11-11',
		view: 'ui',
		style: ['Line and render', 'HUD', 'Pastel'],
		fit: 'offen',
		description:
			'Like 111, without the table: status "Mixed View", completion 58 %, domes as line, structure rendered. A functional sketch: the style is not binding.',
		keep: ['Completion as a percentage per project', 'Mixed View as a named mode'],
		procedural: ['Degree of completion controls the rendered share'],
		tags: ['Mixed View', 'Progress', 'UI']
	},
	{
		id: '113',
		file: 'own-113-ui-utopic-districts-three.webp',
		title: 'Utopic Districts: Three Views',
		added: '2026-11-11',
		view: 'ui',
		style: ['Line', 'Pastel', 'Multiple views'],
		fit: 'offen',
		description:
			'A plate with the main view (axonometric), a plan view (circular plan) and a cross section of a district side by side. A functional sketch: the style is not binding.',
		keep: ['Three views at once: axo, plan, section', 'The same colors in all views'],
		procedural: ['Synchronized views: a selection in one highlights all'],
		tags: ['Multi-perspective', 'Plan', 'Section', 'UI']
	},
	{
		id: '114',
		file: 'own-114-ui-city-planning-matrix.webp',
		title: 'City Planning Matrix: Plan and Section',
		added: '2026-11-11',
		view: 'ui',
		style: ['Line', 'Pastel', 'Plan'],
		fit: 'offen',
		description:
			'On the left a plan with round nodes and paths on contour lines, on the right section B-B′ through a megastructure with habitat levels and a transit atrium. A functional sketch: the style is not binding.',
		keep: ['Plan and section side by side', 'Nodes as circles in the plan'],
		procedural: ['Set a section line in the plan; the section appears next to it'],
		tags: ['Plan', 'Section', 'Nodes', 'UI']
	},
	{
		id: '115',
		file: 'own-115-ui-metabolic-village-ghost.webp',
		title: 'Metabolic Village: Ghost Town',
		added: '2026-11-11',
		view: 'ui',
		style: ['Line and render', 'HUD'],
		fit: 'offen',
		description:
			'A few rendered buildings, the rest of the village only as a ghost line; HUD with categories (Housing, Roads, Natural, Utilities, Edit, Setting). A functional sketch: the style is not binding.',
		keep: ['Planned or third-party buildings as a ghost line'],
		differs: ['"Roads" as a category'],
		procedural: ['Ghost level = envelope level'],
		tags: ['Ghost', 'Envelope', 'HUD', 'UI']
	},
	{
		id: '116',
		file: 'own-116-ui-modules-infrastructure.webp',
		title: 'Modules & Infrastructure',
		added: '2026-11-11',
		view: 'ui',
		style: ['3D render', 'Colorful', 'HUD'],
		fit: 'offen',
		description:
			'A colorful megacomplex with a blob, project data and module previews on the left, labels on the right (Module Type B, Transit_Link), the HUD at the bottom. A functional sketch: the style is not binding.',
		keep: ['Project card on the left with a preview', 'Blob plus modules'],
		procedural: ['Project panel with module thumbnails'],
		tags: ['Project', 'Modules', 'UI']
	},
	{
		id: '117',
		file: 'own-117-ui-metabolic-grid-pencil.webp',
		title: 'Metabolic Grid: Pencil',
		added: '2026-11-11',
		view: 'ui',
		style: ['Pencil', 'Black and white', 'HUD'],
		fit: 'offen',
		description:
			'The district from 25 entirely as a pencil drawing, the HUD unchanged. A functional sketch: the style is not binding.',
		keep: ['The entire scene in sketch mode: the "Sketch" drawing mode works at large scale too'],
		procedural: ['Sketch shader for the whole scene'],
		tags: ['Sketch', 'Drawing mode', 'UI']
	},
	{
		id: '118',
		file: 'own-118-ui-components-terrain.webp',
		title: 'Components and Terrain',
		added: '2026-11-11',
		view: 'ui',
		style: ['Line', 'Transparency', 'Component sheet'],
		fit: 'offen',
		description:
			'A design system sheet: Module 01 Circulation and Volume (a transparent tower with tubes), Module 02 Terrain and Underground (layers, tunnels), component strips with a ramp, ring, truss and stairs. A functional sketch: the style is not binding.',
		keep: ['Component strip as a component library', 'Terrain in layers with an underground'],
		procedural: ['Terrain as a layered solid, tunnels as a section'],
		tags: ['Components', 'Terrain', 'Underground', 'UI']
	},
	{
		id: '119',
		file: 'own-119-ui-design-tools-volumes.webp',
		title: 'Design Tools: Volumes',
		added: '2026-11-11',
		view: 'ui',
		style: ['Line', 'Transparency', 'Metrics'],
		fit: 'offen',
		description:
			'Tools on the left (Site, Structure, Envelope, Circulation, Landscape) and project metrics (area, height, efficiency, sustainability), in the center transparent volumes with red tubes and a scaffold, a preview at the bottom. A functional sketch: the style is not binding.',
		keep: [
			'Tools by design step: site, structure, envelope, circulation, landscape',
			'Sustainability as a metric'
		],
		procedural: ['Build in steps: structure first, then envelope, then circulation'],
		tags: ['Tools', 'Steps', 'Metrics', 'UI']
	},
	{
		id: '120',
		file: 'own-120-ui-focus-resource-loops.webp',
		title: 'Focus: Resource Loops',
		added: '2026-11-11',
		view: 'ui',
		style: ['UI sketch', 'White', 'Blue · Orange'],
		fit: 'offen',
		description:
			'A white city with glowing blue and orange cycles; tabs at the top "Focus: Infrastructure / Resource Loops / Pathways", time of day and speed, switches for loops and pathways on the left, metrics on the right (Water Flow, Grid Capacity, Path Efficiency). A functional sketch: the style is not binding.',
		keep: [
			'Focus tabs at the top: exactly our focus modes',
			'A switch per network',
			'Efficiency metrics per network'
		],
		procedural: ['Focus mode as a tab bar at the top'],
		tags: ['Focus', 'Cycle', 'Tabs', 'UI']
	},
	{
		id: '121',
		file: 'own-121-ui-metropolis-simulator.webp',
		title: 'Metropolis Simulator',
		added: '2026-11-11',
		view: 'ui',
		style: ['UI sketch', 'Classic', 'Pattern'],
		fit: 'offen',
		description:
			'A classic simulator with streets and zones, tools and pattern swatches on the left, a floor plan, legend and curves on the right, a timeline at the bottom. A functional sketch: the style is not binding.',
		keep: ['Pattern swatches (dots, waves, hatching) as a legend'],
		differs: ['Classic streets and zones'],
		procedural: ['Pattern as a second channel in the legend'],
		tags: ['Classic', 'Pattern', 'Counterexample', 'UI']
	},
	{
		id: '122',
		file: 'own-122-ui-minimal-grid-analytics.webp',
		title: 'Minimal Grid with Analytics',
		added: '2026-11-11',
		view: 'ui',
		style: ['UI sketch', 'Minimal', 'Frame'],
		fit: 'offen',
		description:
			'A classic city slab, a plain frame with system status, tools, a minimap, histograms and the selected module. A functional sketch: the style is not binding.',
		keep: ['Selection info "Selected: Comm. Module C3"', 'Minimap and histogram on the right'],
		differs: ['Street grid'],
		procedural: ['Selection panel with module ID'],
		tags: ['Minimal', 'Analytics', 'UI']
	},
	{
		id: '123',
		file: 'own-123-ui-utopic-housing-study.webp',
		title: 'Utopic Housing Study',
		added: '2026-11-11',
		view: 'ui',
		style: ['Collage', 'Sketch', 'Tools'],
		fit: 'offen',
		description:
			'An interactive study as a collage: biomorphic capsules, regenerative gardens, toolbars (Scatter, Extrude, Fabricate Modules), Fibonacci spirals, density sliders, notes. A functional sketch: the style is not binding.',
		keep: [
			'Tools such as Scatter and Extrude: generative building',
			'Fibonacci and spirals as growth logic',
			'Notes and sketches in the world'
		],
		differs: ['Very dense'],
		procedural: ['Scatter tool distributes modules by rule'],
		tags: ['Generative', 'Collage', 'Growth', 'UI']
	},
	{
		id: '124',
		file: 'own-124-ui-analog-dashboard.webp',
		title: 'Analog Dashboard',
		added: '2026-11-11',
		view: 'ui',
		style: ['Collage', 'Paper', 'Stamp'],
		fit: 'offen',
		description:
			'A paper aesthetic with tape, stamps and Polaroids: metrics as pictures (money, face, lightning bolt, leaf), the alert "Grid Overload", the goal "Reconnect District 4", a build menu with marked icons. A functional sketch: the style is not binding.',
		keep: ['Goal and alert as notes', 'Tactile collage as an artistic UI option'],
		differs: ['Streets and cars'],
		procedural: ['Alerts as pinned notes'],
		tags: ['Collage', 'Goal', 'Alert', 'UI']
	},
	{
		id: '125',
		file: 'own-125-ui-workspace-tracking.webp',
		title: 'Workspace with Tracking Overlay',
		added: '2026-11-11',
		view: 'ui',
		style: ['Line', 'Colorful', 'Data'],
		fit: 'offen',
		description:
			'On the left a palette by system (Natural, Infrastructure, Building Units, Metabolics) with image tiles, in the center an existing city with transparent new builds, paths and gardens, on the right curves for biodiversity, community and resource flow. A functional sketch: the style is not binding.',
		keep: [
			'Palette organized by system',
			'Biodiversity and community as metrics',
			'Existing stock as line, new additions in color'
		],
		procedural: ['Metrics column: biodiversity, community flows, resources'],
		tags: ['Palette', 'Metrics', 'Existing stock', 'UI']
	},
	{
		id: '126',
		file: 'own-126-ui-urban-lab-generative.webp',
		title: 'Urban Lab: Generative Sliders',
		added: '2026-11-11',
		view: 'ui',
		style: ['Line', 'Colorful', 'Sliders'],
		fit: 'offen',
		description:
			'A header with simulation, biosphere, density, cycle; on the right "Simulate & Build" with typologies and sliders for Gravity, Biophilia and Density, buttons Regenerate and Adaptive Layer. A functional sketch: the style is not binding.',
		keep: [
			'Generative sliders: biophilia, density, gravity',
			'Regenerate button produces a new variant'
		],
		procedural: ['Generator parameters as sliders in the UI, Regenerate rerolls'],
		tags: ['Generative', 'Sliders', 'Typology', 'UI']
	},
	{
		id: '127',
		file: 'own-127-ui-development-matrix.webp',
		title: 'Development Matrix',
		added: '2026-11-11',
		view: 'ui',
		style: ['3D render', 'White', 'Pipes'],
		fit: 'offen',
		description:
			'A white capsule megablock with yellow and blue pipes, "+ Add Module" buttons, numerals on the components. A functional sketch: the style is not binding.',
		keep: ['"+ Add Module" directly in the scene'],
		procedural: ['Docking buttons at free connections'],
		tags: ['Modules', 'Docking', 'UI']
	},
	{
		id: '128',
		file: 'own-128-ui-telemetry-desert.webp',
		title: 'Telemetry in the Desert',
		added: '2026-11-11',
		view: 'ui',
		style: ['Line', 'Pastel', 'Telemetry'],
		fit: 'offen',
		description:
			'A desert slab with domes, scaffolds and a colorful city, bars for energy, mass and network; telemetry and a minimap on the right, a build menu with geodesic dome, pneumatic structure, mega-grid and biomass. A functional sketch: the style is not binding.',
		keep: [
			'Build menu with utopian types (dome, pneumatic structure, mega-grid)',
			'Modes Construct / Plan / Analysis'
		],
		procedural: ['Utopian types as a building catalog category'],
		tags: ['Build menu', 'Utopia', 'Telemetry', 'UI']
	},
	{
		id: '129',
		file: 'own-129-ui-urban-matrix-module.webp',
		title: 'Urban Matrix with Module Inventory',
		added: '2026-11-11',
		view: 'ui',
		style: ['Line', 'Memphis', 'Colorful'],
		fit: 'offen',
		description:
			'A Memphis city island with domes, arches, ramps and rail lines; at the bottom the module inventory as an icon grid, metabolism and density metrics. A functional sketch: the style is not binding.',
		keep: ['Module inventory as a small icon grid', 'Metabolism as a metric'],
		procedural: ['Inventory shows available modules'],
		tags: ['Inventory', 'Memphis', 'UI']
	},
	{
		id: '130',
		file: 'own-130-ui-circular-city-focus.webp',
		title: 'Circular City: Focus Modes',
		added: '2026-11-11',
		view: 'ui',
		style: ['UI sketch', 'Pastel', 'Panel'],
		fit: 'offen',
		description:
			'The page "Architectural Matrix": a panel with focus modes (Infrastructure, Energy Grid, Water Cycle, Mobility) as switches, efficiency and recovery, on the right a circular city with labeled sectors (energy, water, solar, agricultural domes). A functional sketch: the style is not binding.',
		keep: [
			'Focus modes as switches: confirms the system',
			'Recovery rate as a metric',
			'Ring city with sectors'
		],
		procedural: ['Focus switches can be combined (up to three)'],
		tags: ['Focus', 'Cycle', 'Panel', 'UI']
	},
	{
		id: '131',
		file: 'own-131-ui-editorial-matrix.webp',
		title: 'Editorial Matrix',
		added: '2026-11-11',
		view: 'ui',
		style: ['3D render', 'Colorful', 'Labeling'],
		fit: 'offen',
		description:
			'A left-hand bar with colored components (dream house, transit, satellite), in the center a complex with a blob, domes and scaffolds, crosshairs and coordinates on the components. A functional sketch: the style is not binding.',
		keep: ['Crosshairs on every component', 'Vertical "editorial matrix" label'],
		procedural: ['Component anchor as crosshairs with a coordinate'],
		tags: ['Editorial', 'Anchor', 'Palette', 'UI']
	},
	{
		id: '132',
		file: 'own-132-ui-implant-connect-graft.webp',
		title: 'Implant, Connect, Graft',
		added: '2026-11-11',
		view: 'ui',
		style: ['Collage', 'Sketch', 'Tools'],
		fit: 'offen',
		description:
			'A toolbar of verbs: Implant (House), Connect, Graft, Density/Grid, Trace Line. A scene of capsules, gardens, bridges and sketches; a pen draws a line. A functional sketch: the style is not binding.',
		keep: ['Game verbs: implant, connect, graft, trace', 'Drawing as building'],
		procedural: ['Tools as verbs instead of building types'],
		tags: ['Verbs', 'Tools', 'Drawing', 'UI']
	},
	{
		id: '133',
		file: 'own-133-ui-expand-northward.webp',
		title: 'Expand Northward',
		added: '2026-11-11',
		view: 'ui',
		style: ['Drawing', 'Black and white', 'Paper'],
		fit: 'offen',
		description:
			'A hand-drawn landscape with a river, industry, a village and bridges; header values (Pop, Energy, Materials, Funds), a build menu, notes "Connect to Rail", "Bridge open", "New Sector Active – Expand Northward". A functional sketch: the style is not binding.',
		keep: [
			'Expansion as an event: a new sector',
			'Hints written directly onto the map',
			'Materials as a header value'
		],
		differs: ['Streets as a category'],
		procedural: ['Sector unlock as a map note'],
		tags: ['Expansion', 'Note', 'Map', 'UI']
	},
	{
		id: '134',
		file: 'own-134-ui-tower-construction.webp',
		title: 'Tower in Construction Phases',
		added: '2026-11-11',
		view: 'ui',
		style: ['Line', 'Colorful', 'Construction phases'],
		fit: 'offen',
		description:
			'A tower of steel framing, floors and a blue modular facade, with excavation pits beside it; on the right a component hierarchy (Roof Cap, Modular Cladding, Utility Spine, Steel Framework, Substructure). A functional sketch: the style is not binding.',
		keep: [
			'Component hierarchy from substructure to roof',
			'Excavation pit and scaffold as phases'
		],
		procedural: ['Generator layers: substructure, structural system, utility core, facade, roof'],
		tags: ['Construction phases', 'Hierarchy', 'Scaffold', 'UI']
	},
	{
		id: '135',
		file: 'own-135-ui-voyage-matrix.webp',
		title: 'Voyage Matrix: Underground Section',
		added: '2026-11-11',
		view: 'ui',
		style: ['Line', 'Pastel', 'Section'],
		fit: 'offen',
		description:
			'A district with arches, domes and a railway; in front, section A-A′ through buildings and the underground with a subway and utility lines, density as a metric. A functional sketch: the style is not binding.',
		keep: [
			'Section in front, axonometric behind, in one image',
			'Underground with rail and utility lines'
		],
		procedural: ['Section plane at the front edge of the scene'],
		tags: ['Section', 'Underground', 'Rail', 'UI']
	},
	{
		id: '136',
		file: 'own-136-building-stacked-house-color.webp',
		title: 'Stacked House in Color Frames',
		added: '2026-11-11',
		view: 'gebaeude',
		style: ['Isometric', 'Line', 'Colorful', 'Existing stock as line'],
		fit: 'kern',
		description:
			'A tower house of colored floors and frames (yellow, pink, violet, green), a greenhouse and a tank on top, an existing facade behind it as line; five variants as thumbnails below.',
		keep: [
			'A vertical microcosm in a single drawing',
			'Variant strip below the main image: generator output'
		],
		procedural: ['Variants of a stack as thumbnails to choose from'],
		tags: ['Stack', 'Variants', 'Artwork'],
		source: 'Eigenes Artwork'
	},
	{
		id: '137',
		file: 'own-137-mood-biomorphic-housing-study.webp',
		title: 'Biomorphic Housing Study',
		added: '2026-11-11',
		view: 'stimmung',
		style: ['Collage', 'Sketch', 'Watercolor'],
		fit: 'kern',
		description:
			'The sheet "Utopian Housing Ensemble: The Biomorphic Study": capsule houses, tube bridges, regenerative gardens, cooperative housing, sketches, watercolor stains and notes.',
		keep: ['Collage of sketch, render and watercolor as a signature hand', 'Shared spaces named'],
		procedural: ['Notes and sketches as a layer in the game (cf. 94, 123)'],
		tags: ['Collage', 'Capsule', 'Community', 'Artwork'],
		source: 'Eigenes Artwork'
	},
	{
		id: '138',
		file: 'own-138-mood-utopian-collage-glitch.webp',
		title: 'Utopian Collage with Glitch',
		added: '2026-11-11',
		view: 'stimmung',
		style: ['Collage', 'Pastel', 'Glitch'],
		fit: 'nah',
		description:
			'A pastel collage: tube transit lines, a dome, half-pipes, pools, rocks, city fragments, glitch pixels, people.',
		keep: ['Glitch as a sign of transition and generation', 'Leisure in the city'],
		differs: ['Too dense for game graphics'],
		procedural: ['Glitch effect while generating or converting'],
		tags: ['Glitch', 'Collage', 'Utopia', 'Artwork'],
		source: 'Eigenes Artwork'
	},
	{
		id: '139',
		file: 'own-139-mood-maximal-city-shaft.webp',
		title: 'Maximal City Shaft',
		added: '2026-11-11',
		view: 'stimmung',
		style: ['Collage', 'Maximalism', 'Pastel'],
		fit: 'abweichend',
		description:
			'A vertical view into a dense collage of tubes, watercourses, plants, fragments and figures.',
		keep: ['Stance: abundance and surprise'],
		differs: ['Hardly any orientation'],
		procedural: ['Loading screen, chapter divider'],
		tags: ['Maximalism', 'Collage', 'Artwork'],
		source: 'Eigenes Artwork'
	},
	{
		id: '140',
		file: 'own-140-mood-dome-slides-pools.webp',
		title: 'Dome, Slides, Pools',
		added: '2026-11-11',
		view: 'stimmung',
		style: ['Illustration', 'Pastel', 'White space'],
		fit: 'kern',
		description:
			'A utopian landscape on white: a geodesic dome, slides, pools, scaffold towers, a tube, terrazzo steles, glitch accents.',
		keep: ['A lighter version of the utopia with plenty of white space'],
		procedural: ['Landmark ensemble as a special building'],
		tags: ['Dome', 'Leisure', 'Landmark', 'Artwork'],
		source: 'Eigenes Artwork'
	},
	{
		id: '141',
		file: 'own-141-mood-glitch-axis.webp',
		title: 'Glitch Axis',
		added: '2026-11-11',
		view: 'stimmung',
		style: ['Collage', 'Glitch', 'Line'],
		fit: 'nah',
		description:
			'A symmetrical composition: tubes and frames around a central axis, glitch blocks, plants, a line drawing of the existing city below.',
		keep: ['Existing stock as line carries the collage', 'The axis as a compositional principle'],
		procedural: ['Transition from line → collage as a construction phase'],
		tags: ['Glitch', 'Axis', 'Existing stock', 'Artwork'],
		source: 'Eigenes Artwork'
	},
	{
		id: '142',
		file: 'own-142-mood-form-sculpture-island.webp',
		title: 'Form Sculpture Island',
		added: '2026-11-11',
		view: 'stimmung',
		style: ['Illustration', 'Pastel', 'Labeling'],
		fit: 'nah',
		description:
			'A floating island of hundreds of objects and forms in pastel, on a grid, with hairline labels.',
		keep: ['Form vocabulary as a collection on a plinth', 'Labels with hairlines'],
		differs: ['No scale'],
		procedural: ['Library overview as an island'],
		tags: ['Form vocabulary', 'Island', 'Artwork'],
		source: 'Eigenes Artwork'
	},
	{
		id: '143',
		file: 'own-143-district-pastel-city-band.webp',
		title: 'Pastel City Band',
		added: '2026-11-11',
		view: 'quartier',
		style: ['Isometric', 'Line', 'Pastel', 'Glitch'],
		fit: 'kern',
		description:
			'A diagonal city band: tube transit over towers, pools, squares, domes, drones, people; glitch pixels and plan lines.',
		keep: ['Tube transit as the backbone of a district', 'Pastel palette with pools and squares'],
		procedural: ['Generate a district along a tube transit line'],
		tags: ['Tube', 'District', 'Pastel', 'Artwork'],
		source: 'Eigenes Artwork'
	},
	{
		id: '144',
		file: 'own-144-mood-existing-stock-utopia.webp',
		title: 'Existing Stock Meets Utopia',
		added: '2026-11-11',
		view: 'stimmung',
		style: ['Collage', 'Black and white and color'],
		fit: 'kern',
		description:
			'Black-and-white photos of historic buildings (a cathedral, columns, a prefab slab block) shot through with colored tubes, gardens, watercourses and pastel blobs.',
		keep: [
			'Building on existing stock instead of new construction, as an image: old building gray, intervention in color'
		],
		differs: ['Collage technique'],
		procedural: ['Existing stock in grayscale, interventions in color'],
		tags: ['Existing stock', 'Collage', 'Building on existing stock', 'Artwork'],
		source: 'Eigenes Artwork'
	},
	{
		id: '145',
		file: 'own-145-mood-dome-gardens-night.webp',
		title: 'Dome Gardens at Night',
		added: '2026-11-11',
		view: 'stimmung',
		style: ['Collage', 'Night', 'Plants'],
		fit: 'nah',
		description:
			'A collage on white: glass domes with gardens, pipes, an elevated railway, towers, tropical plants, crowds, constellations and the moon.',
		keep: ['The dome as the guiding form for gardens', 'Day and night as mood'],
		procedural: ['Night mode with constellation lines'],
		tags: ['Dome', 'Garden', 'Night', 'Artwork'],
		source: 'Eigenes Artwork'
	},
	{
		id: '146',
		file: 'own-146-mood-megastructure-wood.webp',
		title: 'Megastructure as a Wood Engraving',
		added: '2026-11-11',
		view: 'stimmung',
		style: ['Wood engraving', 'Black and white', 'Retro-futurism'],
		fit: 'nah',
		description:
			'A black-and-white print: a megastructure of grid towers, bridges, wind turbines, zeppelins and suspended housing boxes.',
		keep: ['Printmaking as a possible drawing mode', 'Megastructure with plug-in boxes'],
		procedural: ['Wood engraving shader as an archive or chronicle view'],
		tags: ['Megastructure', 'Print', 'Archigram', 'Artwork'],
		source: 'Eigenes Artwork'
	},
	{
		id: '147',
		file: 'own-147-city-model-blob.webp',
		title: 'Model City with Blob',
		added: '2026-11-11',
		view: 'stadt',
		style: ['3D render', 'Colorful', 'Model'],
		fit: 'nah',
		description:
			'A rendered city: concrete towers, a blob, domes, tubes, grid houses, solar fields, a river with bridges.',
		keep: ['Overall image of the rendered city with utopian buildings'],
		differs: ['Streets and cars'],
		procedural: ['Reference for the detail level at large scale'],
		tags: ['Render', 'City', 'Artwork'],
		source: 'Eigenes Artwork'
	},
	{
		id: '148',
		file: 'own-148-mood-op-art-neon.webp',
		title: 'Op Art in Neon',
		added: '2026-11-11',
		view: 'stimmung',
		style: ['Screen print', 'Neon', 'Op art'],
		fit: 'offen',
		description:
			'An isometric city with a screen-print look: neon yellow, pink, violet, op art patterns, dimensions.',
		keep: ['Op art patterns as surfaces', 'Screen print as a style variant'],
		differs: ['Foreign color palette'],
		procedural: ['Pattern set for surfaces'],
		tags: ['Op art', 'Pattern', 'Print', 'Artwork'],
		source: 'Eigenes Artwork'
	},
	{
		id: '149',
		file: 'own-149-district-checkerboard-city.webp',
		title: 'Checkerboard City',
		added: '2026-11-11',
		view: 'quartier',
		style: ['Illustration', 'Colorful', 'Memphis'],
		fit: 'kern',
		description:
			'A lively city on checkerboard squares: a spiral tower, slides, an elevated railway, scaffolds with plants, planted arched hills, pools, many people.',
		keep: [
			'Squares as a checkerboard: public space with a pattern',
			'Play and leisure everywhere',
			'Many people bring the city to life'
		],
		procedural: ['Square paving as a pattern tile'],
		tags: ['Memphis', 'Square', 'Leisure', 'Artwork'],
		source: 'Eigenes Artwork'
	},
	{
		id: '150',
		file: 'own-150-district-checkerboard-park.webp',
		title: 'Checkerboard Park',
		added: '2026-11-11',
		view: 'quartier',
		style: ['Illustration', 'Colorful', 'Memphis'],
		fit: 'kern',
		description:
			'A continuation of 149: a park landscape with arched hills, ponds, an elevated railway, scaffold towers and pavilions on checkerboard and yellow.',
		keep: ['Green and water on a patterned square', 'Elevated railway on stilts'],
		procedural: ['Park as a tile set'],
		tags: ['Park', 'Memphis', 'Elevated railway', 'Artwork'],
		source: 'Eigenes Artwork'
	},
	{
		id: '151',
		file: 'own-151-mood-view-eye-level.webp',
		title: 'View at Eye Level',
		added: '2026-11-11',
		view: 'stimmung',
		style: ['3D render', 'Eye level', 'Colorful'],
		fit: 'nah',
		description:
			'A perspective at eye level: colorful cubes, a slide, a mushroom form, a scaffold tower with capsules, tube transit, a wind turbine, a canal and a promenade.',
		keep: ['Eye level as a reward or photo mode'],
		differs: ['Street with cars'],
		procedural: ['Photo mode: camera at pedestrian height'],
		tags: ['Eye level', 'Photo mode', 'Artwork'],
		source: 'Eigenes Artwork'
	},
	{
		id: '156',
		eigen: true,
		vorbild: 'Lucky Lixo, Pablo López de Uralde Montes, ETSAM',
		zweck:
			'Layering principle: an exploded axonometric separates structural system, substructure and envelope → Forms (scaffold · envelope · occupied)',
		zentrum: 'Prinzip',
		file: 'adapt-156-building-scaffold-envelope.webp',
		title: 'Scaffold, Envelope and Occupancy',
		added: '2026-11-13',
		view: 'gebaeude',
		style: ['Exploded axonometric', 'Pastel', 'Wireframe'],
		fit: 'offen',
		description:
			'Original rendering: a house from the Bible in its three states (scaffold, envelope, occupied) as one exploded axonometric, the strut frame as a line lattice, the envelope as a pastel surface.',
		keep: [
			'The exploded view separates envelope, substructure and structural system',
			'Repeated hoods form a continuous roofscape'
		],
		procedural: [
			'Connection principle: plan envelope, substructure and structural system as separate, interrelated layers'
		],
		tags: ['Connection', 'Envelope', 'Structural system', 'Arch', 'Pastel'],
		source: 'Eigenes Artwork'
	},
	{
		id: '160',
		eigen: true,
		vorbild: '',
		zweck:
			'Light envelope principle: a net membrane over high points, diagonals visible, garden plinth → Forms (structural family: membrane)',
		zentrum: 'Prinzip',
		file: 'adapt-160-building-membrane-market-deck.webp',
		title: 'Membrane over the Market Deck',
		added: '2026-11-13',
		view: 'gebaeude',
		style: ['Axonometric', 'Line drawing', 'Wireframe'],
		fit: 'offen',
		description:
			'Original rendering: a membrane roof over a market deck on the elevated walkway, high points on our scaffold columns, the membrane as a fine lattice, planting beds below.',
		keep: [
			'The membrane links individual high points into one shared envelope',
			'Diagonals make the connection between columns and frames visible'
		],
		procedural: [
			'Connection principle: define membrane fields by high points, edge points and columns'
		],
		tags: ['Connection', 'Membrane', 'Column', 'Pavilion', 'Garden'],
		source: 'Eigenes Artwork'
	},
	{
		id: '163',
		eigen: true,
		vorbild: '',
		zweck:
			'Elevated walkway principle: a footbridge and a cable car dock onto the same tower at different heights, red figures → City #hochwege',
		zentrum: 'Prinzip',
		file: 'adapt-163-building-elevated-walkways.webp',
		title: 'Elevated Walkways at the Scaffold Tower',
		added: '2026-11-13',
		view: 'gebaeude',
		style: ['Axonometric', 'Line drawing', 'Flow color'],
		fit: 'offen',
		description:
			'Original rendering: a scaffold tower between existing roofs, where two elevated walkways dock at different heights, fine line, figures in the People flow color.',
		keep: [
			'Footbridge and cable car connect to the same tower at different heights',
			'Open frames show transitions between wall panels and room boxes'
		],
		procedural: [
			'Connection principle: provide infrastructure connections as separate levels on the vertical scaffold'
		],
		tags: ['Connection', 'Tower', 'Bridge', 'Cable car', 'Frame'],
		source: 'Eigenes Artwork'
	}
];

/** Views that actually occur in the archive, in a fixed order. */
export function usedViews(items: Design[]): DesignView[] {
	const present = new Set(items.map((d) => d.view));
	return (Object.keys(viewLabels) as DesignView[]).filter((v) => present.has(v));
}

/** Filters by view; "alle" or empty returns everything. */
export function filterDesigns(items: Design[], view: DesignView | 'alle' | ''): Design[] {
	return !view || view === 'alle' ? items : items.filter((d) => d.view === view);
}
