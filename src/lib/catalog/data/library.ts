/**
 * Library: raw material for generative design.
 * Images under static/library/ (WebP, quality 80). Not yet broken down:
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
		file: 'R01.webp',
		title: 'Cube houses with patterns',
		kind: 'sammlung',
		status: 'roh',
		forms: ['Cube', 'Bulge', 'Lattice cage', 'Sphere'],
		materials: ['Concrete', 'Plastic'],
		surfaces: ['Dots', 'Grid', 'Stripes', 'Lattice']
	},
	{
		id: 'R02',
		file: 'R02.webp',
		title: 'Cube houses with rooftop add-ons',
		kind: 'sammlung',
		status: 'roh',
		forms: ['Cube', 'Gable roof', 'Rooftop add-on'],
		materials: ['Concrete', 'Terrazzo'],
		surfaces: ['Dots', 'Stripes', 'Grid']
	},
	{
		id: 'R03',
		file: 'R03.webp',
		title: 'Nine small buildings on a grid',
		kind: 'sammlung',
		status: 'roh',
		forms: ['Church', 'Glass cube', 'Tower', 'Blob'],
		materials: ['Wood', 'Glass', 'Concrete'],
		surfaces: ['Marble', 'Water blue']
	},
	{
		id: 'R04',
		file: 'R04.webp',
		title: 'Eighteen cube types',
		kind: 'sammlung',
		status: 'roh',
		forms: ['Cube', 'Round tower', 'Crown'],
		materials: ['Concrete', 'Plastic', 'Glass'],
		surfaces: ['Grid', 'Dots', 'Waves']
	},
	{
		id: 'R05',
		file: 'R05.webp',
		title: 'Polyhedron on a plinth',
		kind: 'objekt',
		status: 'roh',
		forms: ['Polyhedron', 'Pipe', 'Arch', 'Spiral'],
		materials: ['Gold', 'Concrete', 'Wood'],
		surfaces: ['Grooves', 'Stripes']
	},
	{
		id: 'R06',
		file: 'R06.webp',
		title: 'Gabled house with light field',
		kind: 'objekt',
		status: 'roh',
		forms: ['Gable', 'Cube'],
		materials: ['Wood', 'Plastic'],
		surfaces: ['Light dots', 'Perforated sheet']
	},
	{
		id: 'R07',
		file: 'R07.webp',
		title: 'Cantilever with light module',
		kind: 'objekt',
		status: 'roh',
		forms: ['Cantilever', 'Column', 'Box'],
		materials: ['Wood', 'Plastic'],
		surfaces: ['Light dots', 'Graphic panel']
	},
	{
		id: 'R08',
		file: 'R08.webp',
		title: 'Stacked tower of wood and light',
		kind: 'objekt',
		status: 'roh',
		forms: ['Stack', 'Gable', 'Antenna'],
		materials: ['Wood'],
		surfaces: ['Light dots']
	},
	{
		id: 'R09',
		file: 'R09.webp',
		title: 'Collage tower with cantilever',
		kind: 'objekt',
		status: 'roh',
		forms: ['Stack', 'Cantilever', 'Facade frame'],
		materials: ['Wood', 'Plastic'],
		surfaces: ['Light dots', 'Graphics']
	},
	{
		id: 'R10',
		file: 'R10.webp',
		title: 'Graphic tower on a platform',
		kind: 'objekt',
		status: 'roh',
		forms: ['Tower', 'Platform', 'Stairs'],
		materials: ['Plastic', 'Concrete'],
		surfaces: ['Memphis graphics']
	},
	{
		id: 'R11',
		file: 'R11.webp',
		title: 'Facade patchwork block',
		kind: 'objekt',
		status: 'roh',
		forms: ['Block', 'Cylinder', 'Stairs'],
		materials: ['Plastic', 'Metal'],
		surfaces: ['Portholes', 'Panels', 'Light field']
	},
	{
		id: 'R12',
		file: 'R12.webp',
		title: 'Brick tower with gardens',
		kind: 'objekt',
		status: 'roh',
		forms: ['Tower', 'Terrace'],
		materials: ['Brick', 'Wood'],
		surfaces: ['Window grid']
	},
	{
		id: 'R13',
		file: 'R13.webp',
		title: 'Tower with balconies and pipe',
		kind: 'objekt',
		status: 'roh',
		forms: ['Tower', 'Balcony', 'Pipe'],
		materials: ['Wood', 'Plastic'],
		surfaces: ['Brick', 'Grid']
	},
	{
		id: 'R14',
		file: 'R14.webp',
		title: 'Slender De Stijl tower',
		kind: 'objekt',
		status: 'roh',
		forms: ['Slab', 'Tower'],
		materials: ['Plastic'],
		surfaces: ['Primary fields', 'Grid']
	},
	{
		id: 'R15',
		file: 'R15.webp',
		title: 'Cushion tower',
		kind: 'objekt',
		status: 'roh',
		forms: ['Cushion', 'Stack'],
		materials: ['Plastic'],
		surfaces: ['Pastel', 'Padding']
	},
	{
		id: 'R16',
		file: 'R16.webp',
		title: 'Eighteen cube types, soft',
		kind: 'sammlung',
		status: 'roh',
		forms: ['Cube', 'Cushion', 'Sphere cluster'],
		materials: ['Plastic', 'Concrete'],
		surfaces: ['Dots', 'Pastel', 'Grid']
	},
	{
		id: 'R17',
		file: 'R17.webp',
		title: 'Tower of slats',
		kind: 'objekt',
		status: 'roh',
		forms: ['Tower', 'Slats', 'Box'],
		materials: ['Wood', 'Plastic'],
		surfaces: ['Slats', 'Grooves']
	},
	{
		id: 'R18',
		file: 'R18.webp',
		title: 'Yellow and red slatted tower',
		kind: 'objekt',
		status: 'roh',
		forms: ['Stack', 'Slats', 'Bulge'],
		materials: ['Plastic'],
		surfaces: ['Ribs', 'Slats']
	},
	{
		id: 'R19',
		file: 'R19.webp',
		title: 'Red studded tower',
		kind: 'objekt',
		status: 'roh',
		forms: ['Tower', 'Studs'],
		materials: ['Plastic'],
		surfaces: ['Studs']
	},
	{
		id: 'R20',
		file: 'R20.webp',
		title: 'Eighteen cube types, special forms',
		kind: 'sammlung',
		status: 'roh',
		forms: ['Cube', 'Sphere cluster', 'Arch', 'Hood'],
		materials: ['Plastic', 'Concrete'],
		surfaces: ['Dots', 'Stripes']
	},
	{
		id: 'R21',
		file: 'R21.webp',
		title: 'Station with elevated railway',
		kind: 'szene',
		status: 'roh',
		forms: ['Platform', 'Elevated railway', 'Glass tower'],
		materials: ['Glass', 'Plastic', 'Concrete'],
		surfaces: ['Graphics', 'Grid']
	},
	{
		id: 'R22',
		file: 'R22.webp',
		title: 'Blue blob at the station',
		kind: 'szene',
		status: 'roh',
		forms: ['Blob', 'Platform', 'Tower'],
		materials: ['Plastic', 'Concrete'],
		surfaces: ['Grid', 'Memphis graphics']
	},
	{
		id: 'R23',
		file: 'R23.webp',
		title: 'Wooden village by the track',
		kind: 'szene',
		status: 'roh',
		forms: ['Gable', 'Cube', 'Stairs', 'Track'],
		materials: ['Wood', 'Plastic'],
		surfaces: ['Light dots', 'Perforated sheet']
	},
	{
		id: 'R24',
		file: 'R24.webp',
		title: 'Station with slatted roof',
		kind: 'szene',
		status: 'roh',
		forms: ['Platform', 'Tower', 'Train'],
		materials: ['Wood', 'Plastic'],
		surfaces: ['Slats']
	},
	{
		id: 'R25',
		file: 'R25.webp',
		title: 'Cushions and glass boxes',
		kind: 'szene',
		status: 'roh',
		forms: ['Cushion', 'Glass box', 'Frame'],
		materials: ['Glass', 'Plastic'],
		surfaces: ['Slats', 'Transparency']
	},
	{
		id: 'R26',
		file: 'R26.webp',
		title: 'Wave plinth with glass cube',
		kind: 'objekt',
		status: 'roh',
		forms: ['Plinth', 'Cube', 'Pipe', 'Cushion'],
		materials: ['Plastic', 'Glass'],
		surfaces: ['Wavy lines', 'Slats']
	},
	{
		id: 'R27',
		file: 'R27.webp',
		title: 'Bauhaus ensemble with cylinder',
		kind: 'szene',
		status: 'roh',
		forms: ['Cube', 'Cylinder', 'Stairs', 'Rock'],
		materials: ['Plastic', 'Glass'],
		surfaces: ['Slats', 'Transparency']
	},
	{
		id: 'R28',
		file: 'R28.webp',
		title: 'Curved wall with gable',
		kind: 'objekt',
		status: 'roh',
		forms: ['Curved wall', 'Gable', 'Stairs'],
		materials: ['Wood', 'Plastic'],
		surfaces: ['Light dots', 'Memphis pattern']
	},
	{
		id: 'R29',
		file: 'R29.webp',
		title: 'District with spiral ramp',
		kind: 'szene',
		status: 'roh',
		forms: ['Tower', 'Spiral', 'Bridge', 'Cantilever'],
		materials: ['Plastic', 'Concrete'],
		surfaces: ['Op art', 'Grid', 'Light dots']
	},
	{
		id: 'R30',
		file: 'R30.webp',
		title: 'Wooden houses with tanks',
		kind: 'szene',
		status: 'roh',
		forms: ['Cube', 'Tank', 'Pipe'],
		materials: ['Wood', 'Copper'],
		surfaces: ['Gradient']
	},
	{
		id: 'R31',
		file: 'R31.webp',
		title: 'Pastel building with gradient',
		kind: 'objekt',
		status: 'roh',
		forms: ['Cube', 'Rooftop add-on'],
		materials: ['Wood', 'Plastic'],
		surfaces: ['Gradient', 'Stripes']
	},
	{
		id: 'R32',
		file: 'R32.webp',
		title: 'Roof terrace house with stairs',
		kind: 'objekt',
		status: 'roh',
		forms: ['Cube', 'Stairs', 'Bracket'],
		materials: ['Plastic', 'Glass'],
		surfaces: ['Tiles', 'Terrazzo']
	},
	{
		id: 'R33',
		file: 'R33.webp',
		title: 'Compact Bauhaus house',
		kind: 'objekt',
		status: 'roh',
		forms: ['Cube', 'Bay window', 'Stairs'],
		materials: ['Plastic', 'Wood'],
		surfaces: ['Primary fields']
	},
	{
		id: 'R34',
		file: 'R34.webp',
		title: 'Pink house with tower',
		kind: 'objekt',
		status: 'roh',
		forms: ['Cube', 'Tower', 'Stairs'],
		materials: ['Plaster', 'Concrete'],
		surfaces: ['Portholes', 'Window grid']
	},
	{
		id: 'R35',
		file: 'R35.webp',
		title: 'Blue frame house',
		kind: 'objekt',
		status: 'roh',
		forms: ['Frame', 'Cantilever', 'Slope'],
		materials: ['Wood', 'Metal'],
		surfaces: ['Rust']
	},
	{
		id: 'R36',
		file: 'R36.webp',
		title: 'Yellow house with striped bracket',
		kind: 'objekt',
		status: 'roh',
		forms: ['Cube', 'Bracket'],
		materials: ['Plastic'],
		surfaces: ['Stripes']
	},
	{
		id: 'R37',
		file: 'R37.webp',
		title: 'Cantilevered box on light blue',
		kind: 'objekt',
		status: 'roh',
		forms: ['Cube', 'Cantilevered box'],
		materials: ['Wood', 'Plaster'],
		surfaces: ['Slats']
	},
	{
		id: 'R38',
		file: 'R38.webp',
		title: 'Bauhaus house with striped bracket',
		kind: 'objekt',
		status: 'roh',
		forms: ['Cube', 'Bracket', 'Tower', 'Stairs'],
		materials: ['Wood', 'Plaster', 'Brick'],
		surfaces: ['Stripes', 'Primary fields']
	},
	{
		id: 'R39',
		file: 'R39.webp',
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
