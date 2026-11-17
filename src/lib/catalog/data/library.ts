/**
 * Library: raw material for generative design.
 * Images under static/img/ (WebP, quality 80). Not yet broken down:
 * later sort, cut out and split into forms, materials and surfaces.
 */

export type RawKind = 'sammlung' | 'objekt' | 'szene';
export type RawStatus = 'roh' | 'sortiert' | 'freigestellt' | 'zerlegt';

export type RawItem = {
	id: string;
	file: string;
	title: string;
	/** Collection = many objects in one image, object = one building, scene = ensemble. */
	kind: RawKind;
	status: RawStatus;
	/** What can be extracted (first review, estimate). */
	forms: string[];
	materials: string[];
	surfaces: string[];
};

export const kindLabels: Record<RawKind, string> = {
	sammlung: 'Collection',
	objekt: 'Object',
	szene: 'Scene'
};

export const statusLabels: Record<RawStatus, string> = {
	roh: 'Raw',
	sortiert: 'Sorted',
	freigestellt: 'Cut out',
	zerlegt: 'Broken down'
};

export const library: RawItem[] = [
	{
		id: 'R01',
		file: 'raw-001-collection-cube-houses-patterns.webp',
		title: 'Cube houses with patterns',
		kind: 'sammlung',
		status: 'roh',
		forms: ['Cube', 'Bulge', 'Lattice cage', 'Sphere'],
		materials: ['Concrete', 'Plastic'],
		surfaces: ['Dots', 'Grid', 'Stripes', 'Lattice']
	},
	{
		id: 'R02',
		file: 'raw-002-collection-cube-houses-rooftop.webp',
		title: 'Cube houses with rooftop add-ons',
		kind: 'sammlung',
		status: 'roh',
		forms: ['Cube', 'Gable roof', 'Rooftop add-on'],
		materials: ['Concrete', 'Terrazzo'],
		surfaces: ['Dots', 'Stripes', 'Grid']
	},
	{
		id: 'R03',
		file: 'raw-003-collection-nine-small-buildings.webp',
		title: 'Nine small buildings on a grid',
		kind: 'sammlung',
		status: 'roh',
		forms: ['Church', 'Glass cube', 'Tower', 'Blob'],
		materials: ['Wood', 'Glass', 'Concrete'],
		surfaces: ['Marble', 'Water blue']
	},
	{
		id: 'R04',
		file: 'raw-004-collection-eighteen-cube-types.webp',
		title: 'Eighteen cube types',
		kind: 'sammlung',
		status: 'roh',
		forms: ['Cube', 'Round tower', 'Crown'],
		materials: ['Concrete', 'Plastic', 'Glass'],
		surfaces: ['Grid', 'Dots', 'Waves']
	},
	{
		id: 'R05',
		file: 'raw-005-object-polyhedron-plinth.webp',
		title: 'Polyhedron on a plinth',
		kind: 'objekt',
		status: 'roh',
		forms: ['Polyhedron', 'Pipe', 'Arch', 'Spiral'],
		materials: ['Gold', 'Concrete', 'Wood'],
		surfaces: ['Grooves', 'Stripes']
	},
	{
		id: 'R06',
		file: 'raw-006-object-gabled-house-light.webp',
		title: 'Gabled house with light field',
		kind: 'objekt',
		status: 'roh',
		forms: ['Gable', 'Cube'],
		materials: ['Wood', 'Plastic'],
		surfaces: ['Light dots', 'Perforated sheet']
	},
	{
		id: 'R07',
		file: 'raw-007-object-cantilever-light-module.webp',
		title: 'Cantilever with light module',
		kind: 'objekt',
		status: 'roh',
		forms: ['Cantilever', 'Column', 'Box'],
		materials: ['Wood', 'Plastic'],
		surfaces: ['Light dots', 'Graphic panel']
	},
	{
		id: 'R08',
		file: 'raw-008-object-stacked-tower-wood.webp',
		title: 'Stacked tower of wood and light',
		kind: 'objekt',
		status: 'roh',
		forms: ['Stack', 'Gable', 'Antenna'],
		materials: ['Wood'],
		surfaces: ['Light dots']
	},
	{
		id: 'R09',
		file: 'raw-009-object-collage-tower-cantilever.webp',
		title: 'Collage tower with cantilever',
		kind: 'objekt',
		status: 'roh',
		forms: ['Stack', 'Cantilever', 'Facade frame'],
		materials: ['Wood', 'Plastic'],
		surfaces: ['Light dots', 'Graphics']
	},
	{
		id: 'R10',
		file: 'raw-010-object-graphic-tower-platform.webp',
		title: 'Graphic tower on a platform',
		kind: 'objekt',
		status: 'roh',
		forms: ['Tower', 'Platform', 'Stairs'],
		materials: ['Plastic', 'Concrete'],
		surfaces: ['Memphis graphics']
	},
	{
		id: 'R11',
		file: 'raw-011-object-facade-patchwork-block.webp',
		title: 'Facade patchwork block',
		kind: 'objekt',
		status: 'roh',
		forms: ['Block', 'Cylinder', 'Stairs'],
		materials: ['Plastic', 'Metal'],
		surfaces: ['Portholes', 'Panels', 'Light field']
	},
	{
		id: 'R12',
		file: 'raw-012-object-brick-tower-gardens.webp',
		title: 'Brick tower with gardens',
		kind: 'objekt',
		status: 'roh',
		forms: ['Tower', 'Terrace'],
		materials: ['Brick', 'Wood'],
		surfaces: ['Window grid']
	},
	{
		id: 'R13',
		file: 'raw-013-object-tower-balconies-pipe.webp',
		title: 'Tower with balconies and pipe',
		kind: 'objekt',
		status: 'roh',
		forms: ['Tower', 'Balcony', 'Pipe'],
		materials: ['Wood', 'Plastic'],
		surfaces: ['Brick', 'Grid']
	},
	{
		id: 'R14',
		file: 'raw-014-object-slender-de-stijl.webp',
		title: 'Slender De Stijl tower',
		kind: 'objekt',
		status: 'roh',
		forms: ['Slab', 'Tower'],
		materials: ['Plastic'],
		surfaces: ['Primary fields', 'Grid']
	},
	{
		id: 'R15',
		file: 'raw-015-object-cushion-tower.webp',
		title: 'Cushion tower',
		kind: 'objekt',
		status: 'roh',
		forms: ['Cushion', 'Stack'],
		materials: ['Plastic'],
		surfaces: ['Pastel', 'Padding']
	},
	{
		id: 'R16',
		file: 'raw-016-collection-soft-cube-types.webp',
		title: 'Eighteen cube types, soft',
		kind: 'sammlung',
		status: 'roh',
		forms: ['Cube', 'Cushion', 'Sphere cluster'],
		materials: ['Plastic', 'Concrete'],
		surfaces: ['Dots', 'Pastel', 'Grid']
	},
	{
		id: 'R17',
		file: 'raw-017-object-tower-slats.webp',
		title: 'Tower of slats',
		kind: 'objekt',
		status: 'roh',
		forms: ['Tower', 'Slats', 'Box'],
		materials: ['Wood', 'Plastic'],
		surfaces: ['Slats', 'Grooves']
	},
	{
		id: 'R18',
		file: 'raw-018-object-yellow-red-slatted.webp',
		title: 'Yellow and red slatted tower',
		kind: 'objekt',
		status: 'roh',
		forms: ['Stack', 'Slats', 'Bulge'],
		materials: ['Plastic'],
		surfaces: ['Ribs', 'Slats']
	},
	{
		id: 'R19',
		file: 'raw-019-object-red-studded-tower.webp',
		title: 'Red studded tower',
		kind: 'objekt',
		status: 'roh',
		forms: ['Tower', 'Studs'],
		materials: ['Plastic'],
		surfaces: ['Studs']
	},
	{
		id: 'R20',
		file: 'raw-020-collection-special-cube-types.webp',
		title: 'Eighteen cube types, special forms',
		kind: 'sammlung',
		status: 'roh',
		forms: ['Cube', 'Sphere cluster', 'Arch', 'Hood'],
		materials: ['Plastic', 'Concrete'],
		surfaces: ['Dots', 'Stripes']
	},
	{
		id: 'R21',
		file: 'raw-021-scene-station-elevated-railway.webp',
		title: 'Station with elevated railway',
		kind: 'szene',
		status: 'roh',
		forms: ['Platform', 'Elevated railway', 'Glass tower'],
		materials: ['Glass', 'Plastic', 'Concrete'],
		surfaces: ['Graphics', 'Grid']
	},
	{
		id: 'R22',
		file: 'raw-022-scene-blue-blob-station.webp',
		title: 'Blue blob at the station',
		kind: 'szene',
		status: 'roh',
		forms: ['Blob', 'Platform', 'Tower'],
		materials: ['Plastic', 'Concrete'],
		surfaces: ['Grid', 'Memphis graphics']
	},
	{
		id: 'R23',
		file: 'raw-023-scene-wooden-village-track.webp',
		title: 'Wooden village by the track',
		kind: 'szene',
		status: 'roh',
		forms: ['Gable', 'Cube', 'Stairs', 'Track'],
		materials: ['Wood', 'Plastic'],
		surfaces: ['Light dots', 'Perforated sheet']
	},
	{
		id: 'R24',
		file: 'raw-024-scene-station-slatted-roof.webp',
		title: 'Station with slatted roof',
		kind: 'szene',
		status: 'roh',
		forms: ['Platform', 'Tower', 'Train'],
		materials: ['Wood', 'Plastic'],
		surfaces: ['Slats']
	},
	{
		id: 'R25',
		file: 'raw-025-scene-cushions-glass-boxes.webp',
		title: 'Cushions and glass boxes',
		kind: 'szene',
		status: 'roh',
		forms: ['Cushion', 'Glass box', 'Frame'],
		materials: ['Glass', 'Plastic'],
		surfaces: ['Slats', 'Transparency']
	},
	{
		id: 'R26',
		file: 'raw-026-object-wave-plinth-glass.webp',
		title: 'Wave plinth with glass cube',
		kind: 'objekt',
		status: 'roh',
		forms: ['Plinth', 'Cube', 'Pipe', 'Cushion'],
		materials: ['Plastic', 'Glass'],
		surfaces: ['Wavy lines', 'Slats']
	},
	{
		id: 'R27',
		file: 'raw-027-scene-bauhaus-ensemble.webp',
		title: 'Bauhaus ensemble with cylinder',
		kind: 'szene',
		status: 'roh',
		forms: ['Cube', 'Cylinder', 'Stairs', 'Rock'],
		materials: ['Plastic', 'Glass'],
		surfaces: ['Slats', 'Transparency']
	},
	{
		id: 'R28',
		file: 'raw-028-object-curved-wall-gable.webp',
		title: 'Curved wall with gable',
		kind: 'objekt',
		status: 'roh',
		forms: ['Curved wall', 'Gable', 'Stairs'],
		materials: ['Wood', 'Plastic'],
		surfaces: ['Light dots', 'Memphis pattern']
	},
	{
		id: 'R29',
		file: 'raw-029-scene-district-spiral-ramp.webp',
		title: 'District with spiral ramp',
		kind: 'szene',
		status: 'roh',
		forms: ['Tower', 'Spiral', 'Bridge', 'Cantilever'],
		materials: ['Plastic', 'Concrete'],
		surfaces: ['Op art', 'Grid', 'Light dots']
	},
	{
		id: 'R30',
		file: 'raw-030-scene-wooden-houses-tanks.webp',
		title: 'Wooden houses with tanks',
		kind: 'szene',
		status: 'roh',
		forms: ['Cube', 'Tank', 'Pipe'],
		materials: ['Wood', 'Copper'],
		surfaces: ['Gradient']
	},
	{
		id: 'R31',
		file: 'raw-031-object-pastel-building-gradient.webp',
		title: 'Pastel building with gradient',
		kind: 'objekt',
		status: 'roh',
		forms: ['Cube', 'Rooftop add-on'],
		materials: ['Wood', 'Plastic'],
		surfaces: ['Gradient', 'Stripes']
	},
	{
		id: 'R32',
		file: 'raw-032-object-roof-terrace-house.webp',
		title: 'Roof terrace house with stairs',
		kind: 'objekt',
		status: 'roh',
		forms: ['Cube', 'Stairs', 'Bracket'],
		materials: ['Plastic', 'Glass'],
		surfaces: ['Tiles', 'Terrazzo']
	},
	{
		id: 'R33',
		file: 'raw-033-object-compact-bauhaus-house.webp',
		title: 'Compact Bauhaus house',
		kind: 'objekt',
		status: 'roh',
		forms: ['Cube', 'Bay window', 'Stairs'],
		materials: ['Plastic', 'Wood'],
		surfaces: ['Primary fields']
	},
	{
		id: 'R34',
		file: 'raw-034-object-pink-house-tower.webp',
		title: 'Pink house with tower',
		kind: 'objekt',
		status: 'roh',
		forms: ['Cube', 'Tower', 'Stairs'],
		materials: ['Plaster', 'Concrete'],
		surfaces: ['Portholes', 'Window grid']
	},
	{
		id: 'R35',
		file: 'raw-035-object-blue-frame-house.webp',
		title: 'Blue frame house',
		kind: 'objekt',
		status: 'roh',
		forms: ['Frame', 'Cantilever', 'Slope'],
		materials: ['Wood', 'Metal'],
		surfaces: ['Rust']
	},
	{
		id: 'R36',
		file: 'raw-036-object-yellow-house-striped.webp',
		title: 'Yellow house with striped bracket',
		kind: 'objekt',
		status: 'roh',
		forms: ['Cube', 'Bracket'],
		materials: ['Plastic'],
		surfaces: ['Stripes']
	},
	{
		id: 'R37',
		file: 'raw-037-object-cantilevered-box-light.webp',
		title: 'Cantilevered box on light blue',
		kind: 'objekt',
		status: 'roh',
		forms: ['Cube', 'Cantilevered box'],
		materials: ['Wood', 'Plaster'],
		surfaces: ['Slats']
	},
	{
		id: 'R38',
		file: 'raw-038-object-bauhaus-house-striped.webp',
		title: 'Bauhaus house with striped bracket',
		kind: 'objekt',
		status: 'roh',
		forms: ['Cube', 'Bracket', 'Tower', 'Stairs'],
		materials: ['Wood', 'Plaster', 'Brick'],
		surfaces: ['Stripes', 'Primary fields']
	},
	{
		id: 'R39',
		file: 'raw-039-object-core-tower-cantilevers.webp',
		title: 'Core tower with cantilevers',
		kind: 'objekt',
		status: 'roh',
		forms: ['Core', 'Cantilevered box', 'Spiral', 'Platform'],
		materials: ['Plaster', 'Glass'],
		surfaces: ['Terracotta', 'Mint']
	}
];

/** All terms of a column with their frequency, most frequent first: the basis for the later breakdown. */
export function tally(items: RawItem[], key: 'forms' | 'materials' | 'surfaces') {
	const counts = new Map<string, number>();
	for (const item of items)
		for (const term of item[key]) counts.set(term, (counts.get(term) ?? 0) + 1);
	return [...counts]
		.map(([term, count]) => ({ term, count }))
		.sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
}
