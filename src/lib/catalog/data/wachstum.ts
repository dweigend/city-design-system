/**
 * Growth chapter (replaces Modeling): texts, teaching examples and demo settings.
 * Paths first, then blocks; fields; splitting; parcels without streets; WFC; method matrix.
 * Sources: docs/research/04-city-rules.md, 05-bible-structure.md §4.
 */
import type { Phase } from './raster';
import type { BlockSpec, DriverSpec } from './parzelle';
import type { AltstadtId } from './altstaedte';

export type Abschnitt = { id: string; titel: string; lead?: string };

/* 1 · Paths first, then blocks */

export const wegeZuerst: Abschnitt = {
	id: 'wachstum-wege',
	titel: 'Paths first, then blocks',
	lead: 'Organic cities form the other way around from planned ones. Paths run from gates and squares into the land, and whatever stays open between them becomes a block. Same seed, same city.'
};

export type Familie = 'zugang' | 'feld' | 'ring';

export type Wachstumsregel = {
	id: string;
	name: string;
	familie: Familie;
	bindung: number;
	text: string;
};

export const wachstumsregeln: Wachstumsregel[] = [
	{
		id: 'wege',
		name: 'Paths first',
		familie: 'zugang',
		bindung: 0,
		text: 'Main paths run from the gates to the center; alleys branch off them and usually end at another path. This creates T-junctions and blocks of every size.'
	},
	{
		id: 'bindung',
		name: 'Paths with direction',
		familie: 'zugang',
		bindung: 0.45,
		text: 'The same paths, loosely bound to a main direction. Blocks grow more elongated; alleys run side by side more calmly.'
	},
	{
		id: 'feld',
		name: 'Direction field',
		familie: 'feld',
		bindung: 0,
		text: 'A smooth field assigns two directions to every location. Paths follow it like fibers, producing a curved grid: dense at the center, wide at the edge.'
	},
	{
		id: 'ring',
		name: 'Rings around a core',
		familie: 'ring',
		bindung: 0,
		text: 'Paths wrap around a core in shells, and spokes lead outward. This is how cities grew around a castle or a market.'
	}
];

export const altstadtVergleich: { id: AltstadtId; text: string }[] = [
	{
		id: 'siena',
		text: 'Siena, same scale: alleys almost always meet as a T; hardly any crosses straight through.'
	},
	{
		id: 'regensburg',
		text: 'Regensburg, same scale: the Roman camp still lies beneath the medieval fabric.'
	},
	{
		id: 'fes',
		text: 'Fès, same scale: dead-end alleys lead deep into the blocks; the residential courtyards lie inside.'
	},
	{
		id: 'marrakesch',
		text: 'Marrakesch, same scale: a few main paths, with a dense web of cul-de-sacs in between.'
	}
];

/** Measurement deep dive: plain-language names of the four metrics; ranges of real old towns from 102. */
export const kennwertNamen = {
	a50: 'Typical block size in m²',
	cv: 'Unevenness of blocks',
	h: 'Variety of directions',
	t: 'Share of T-junctions in %'
} as const;

/* 3 · Fields */

export const felder: Abschnitt = {
	id: 'wachstum-felder',
	titel: 'Fields set the direction, not the place',
	lead: 'A field lays a tendency over the whole district. It decides nothing; it suggests. Paths and buildings follow it, however many there are.'
};

export type FeldModus = 'richtung' | 'abstand' | 'anziehung';
export const feldModi: { id: FeldModus; name: string; text: string }[] = [
	{
		id: 'richtung',
		name: 'Direction',
		text: 'Each stroke shows the preferred direction at its location; its length shows density. The lines follow the field the way alleys follow a slope.'
	},
	{
		id: 'abstand',
		name: 'Distance',
		text: 'Three circles merge softly. Each line keeps the same distance to them everywhere, one every 4 m, like shorelines or contour lines.'
	},
	{
		id: 'anziehung',
		name: 'Attraction',
		text: 'A point attracts height: the closer a building stands to it, the taller it grows. A single value steers every building in the district.'
	}
];
export const feldHinweis = 'Drag the point.';

/* 4 · Splitting */

export const teilen: Abschnitt = {
	id: 'wachstum-teilen',
	titel: 'A block splits, and every part knows its origin',
	lead: 'A split tree cuts the block first into strips, then into parcels. It records every cut. That is why a parcel keeps its name even when its dimensions shift.'
};

export const teilungPhasen: Phase[] = [
	{
		id: 'schnitt',
		titel: 'First cut',
		text: 'Perpendicular to frontage: both halves still face the alley.'
	},
	{
		id: 'streifen',
		titel: 'Strips',
		text: 'Each half keeps splitting, always perpendicular to frontage.'
	},
	{
		id: 'parzellen',
		titel: 'Parcels',
		text: 'After four splits, every part is one building wide, none narrower than 6 m along the alley.'
	},
	{
		id: 'fliessen',
		titel: 'Dimensions flow',
		text: 'The cuts move. The number and names of the parcels stay; the highlighted one is always the same.'
	}
];

/** Teaching example for the loop: depth per phase; in the last phase t moves within `fliessen`. */
export const teilenBeispiel = {
	saat: 2,
	front: 6,
	tiefen: [1, 2, 4, 4],
	fliessen: [0.35, 0.65] as const
};

/* 5 · Parcels without streets */

export const parzellen: Abschnitt = {
	id: 'wachstum-parzellen',
	titel: 'Lots hang on paths, not on streets',
	lead: 'A lot has access if you can reach it on foot: by alley, square, elevated walkway or transit stop. The core of the block belongs to everyone, and over the decades the city keeps recutting its lots.'
};

export type ParzellenBlock = { id: string; name: string; spec: BlockSpec; schutz: number };

export const parzellenBloecke: ParzellenBlock[] = [
	{
		id: 'gassen',
		name: 'Alleys all around',
		schutz: 3,
		spec: {
			id: 'block',
			ring: [
				[0, 0],
				[72, 0],
				[72, 48],
				[0, 48]
			],
			edges: ['footway', 'footway', 'footway', 'footway']
		}
	},
	{
		id: 'platz',
		name: 'Square, stop and waterfront',
		schutz: 2,
		spec: {
			id: 'hex',
			ring: [
				[0, 0],
				[65, 0],
				[110, 50],
				[110, 85],
				[30, 85],
				[0, 55]
			],
			edges: ['square', 'footway', 'skywalk', 'water', 'party', 'green'],
			stops: [{ edge: 1, t: 0.5 }]
		}
	},
	{
		id: 'spitz',
		name: 'Pointed block',
		schutz: 2,
		spec: {
			id: 'spitz',
			ring: [
				[0, 0],
				[130, 0],
				[65, 50],
				[20, 50]
			],
			edges: ['footway', 'footway', 'footway', 'footway']
		}
	}
];

export type Epoche = {
	id: string;
	titel: string;
	text: string;
	treiber?: DriverSpec;
	schritte: number;
};

/** Founding first, then three eras with their own drivers. Existing stock stays gray in every era. */
export const epochen: Epoche[] = [
	{
		id: 'gruendung',
		titel: 'Founding',
		schritte: 0,
		text: 'Each access edge gets a perimeter strip, cut crosswise into parcels with about 9 m of frontage. The rest becomes courtyard, and a passage leads in.'
	},
	{
		id: 'verdichtung',
		titel: 'Densification',
		schritte: 2,
		treiber: { split: 0.45, merge: 0.05, convert: 0.1 },
		text: 'Land grows scarce, and lots are split. Each half needs 5 m of frontage on an alley, square, elevated walkway or stop; the courtyard side does not count.'
	},
	{
		id: 'krise',
		titel: 'Crisis',
		schritte: 1,
		treiber: { split: 0.05, merge: 0.4, convert: 0.1 },
		text: 'Those who stay merge: neighbors become one parcel. What does not fit is rejected, never silently moved.'
	},
	{
		id: 'wandel',
		titel: 'Transition',
		schritte: 1,
		treiber: { split: 0, merge: 0, convert: 0.6 },
		text: 'Climate and residents change: a workshop becomes a farm, an apartment becomes a workplace. The boundaries stay; only the use changes.'
	}
];

export const parzellenLegende = {
	gasse: 'Alley',
	platz: 'Square',
	hochweg: 'Elevated walkway',
	halt: 'Transit stop',
	gruen: 'Green corridor',
	ufer: 'Waterfront',
	wand: 'Party wall',
	hof: 'Shared courtyard',
	durchgang: 'Passage',
	bestand: 'Existing stock',
	neu: 'New'
};

/** Use of freshly changed parcels in the color of their flow: living and mixed as People, work as Material, farm as Food. */
export const nutzungen = [
	{ id: 'living', name: 'Living' },
	{ id: 'mixed', name: 'Mixed' },
	{ id: 'work', name: 'Work' },
	{ id: 'farm', name: 'Farm' }
] as const;

/* 6 · Wave Function Collapse */

export const wfc: Abschnitt = {
	id: 'wachstum-wfc',
	titel: 'Where many things fit, the neighbors decide',
	lead: 'Wave Function Collapse places tiles like a sudoku: every cell starts with all possibilities, and every choice strikes from the neighbors whatever no longer fits. A separate step then checks whether every footbridge reaches a gate.'
};

/* 7 · Method matrix */

export const matrix: Abschnitt = {
	id: 'wachstum-verfahren',
	titel: 'Every method has its task',
	lead: 'No method builds the city alone. Only together do they produce ground, parcel, building and path.'
};

export type Verfahren = { id: string; titel: string; ziel: string };
/** `ziel`: anchor on this page (#…) or path with anchor in another chapter. */
export const verfahren: Verfahren[] = [
	{ id: 'wachstum', titel: 'Paths first', ziel: `#${wegeZuerst.id}` },
	{ id: 'felder', titel: 'Fields', ziel: `#${felder.id}` },
	{ id: 'teilung', titel: 'Split tree', ziel: `#${teilen.id}` },
	{ id: 'parzellen', titel: 'Parcels', ziel: `#${parzellen.id}` },
	{ id: 'wfc', titel: 'Wave Function Collapse', ziel: `#${wfc.id}` },
	{ id: 'raster', titel: 'Universal grid', ziel: '/raster#raster-vierecke' },
	{ id: 'traeger', titel: 'Fixed carrier', ziel: '/raster#raster-spielraum' },
	{ id: 'eck', titel: 'Corner modules', ziel: '/formen/haus' }
];

export type Aufgabe = {
	aufgabe: string;
	haupt: string;
	mit: string[];
	warum: string;
	nicht: string;
};

export const aufgaben: Aufgabe[] = [
	{
		aufgabe: 'Alleys look grown, not planned',
		haupt: 'wachstum',
		mit: ['felder'],
		warum:
			'Paths grow first; blocks are what remains. This creates uneven blocks like those in old towns.',
		nicht: 'A split tree alone cuts too regularly and looks planned.'
	},
	{
		aufgabe: 'Density and direction for a whole district',
		haupt: 'felder',
		mit: ['wachstum', 'traeger'],
		warum: 'A field lays a tendency over many buildings, however many there are.',
		nicht: 'A field decides nothing: it knows no neighbors and no names.'
	},
	{
		aufgabe: 'A block becomes buildings',
		haupt: 'teilung',
		mit: ['parzellen', 'traeger'],
		warum: 'The tree records every cut; every parcel keeps its name.',
		nicht: 'Access does not arise on its own; it needs the rule “perpendicular to frontage.”'
	},
	{
		aufgabe: 'Every lot is reachable on foot',
		haupt: 'parzellen',
		mit: ['teilung'],
		warum:
			'Perimeter strips along alley, square, elevated walkway and stop; the core becomes a shared courtyard.',
		nicht: 'Without an access edge there is no lot; waterfront and track provide no access.'
	},
	{
		aufgabe: 'The city changes over epochs',
		haupt: 'parzellen',
		mit: ['traeger'],
		warum: 'Split, merge and convert are events; existing stock stays untouched.',
		nicht: 'No rebuild of the whole city: each event touches only itself and its neighbors.'
	},
	{
		aufgabe: 'Choosing the right one among many variants',
		haupt: 'wfc',
		mit: ['eck'],
		warum: 'Every choice fits its neighbors, even when several connections compete.',
		nicht:
			'No substitute for path planning: a separate step checks whether everything is reachable.'
	},
	{
		aufgabe: 'The same buildings on every grid',
		haupt: 'raster',
		mit: ['eck'],
		warum: 'Everything becomes a quad, and modules know only quads.',
		nicht: 'Fields provide no cells and no fixed names.'
	},
	{
		aufgabe: 'The ground moves, the buildings stay',
		haupt: 'traeger',
		mit: ['teilung'],
		warum: 'Only corners move; adjacency and names stay, and parcels move along.',
		nicht: 'Switching grids is not a movement but a new city.'
	}
];
