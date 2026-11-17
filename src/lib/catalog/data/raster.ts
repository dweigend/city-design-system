/**
 * Grid chapter: copy for the three sections. One simulation (nine grids, five layers),
 * then two explainer loops (quad subdivision, corner leeway). Corner modules belong to Forms.
 * Sources: docs/research/01-universal-grid.md, 05-bible-structure.md §3.
 */

export type Abschnitt = { id: string; titel: string; lead: string };

export const grund: Abschnitt = {
	id: 'raster-grund',
	titel: 'The city stands on any ground',
	lead: 'Checkerboard, honeycomb or organically grown old town: the grid only sets the blocks. Everything built on top follows the same rules everywhere.'
};

export type SchichtId = 'bloecke' | 'zellen' | 'vierecke' | 'ecken' | 'stadt';
export type Schicht = {
	id: SchichtId;
	name: string;
	text: string;
	weiter?: { pfad: '/formen/haus'; text: string };
};

/** The layers in sequence: each one arises from the one before. */
export const schichten: Schicht[] = [
	{
		id: 'bloecke',
		name: 'Blocks',
		text: 'The grid lays out only blocks. Their edges are the alleys.'
	},
	{
		id: 'zellen',
		name: 'Cells',
		text: 'Every block edge gets the same number of divisions. That is why triangle, quad and polygon meet without a seam.'
	},
	{
		id: 'vierecke',
		name: 'Quads',
		text: 'Every cell breaks down into quads. From here on, every grid is the same.'
	},
	{
		id: 'ecken',
		name: 'Corners',
		text: 'Any corner inside a block can be built on; the corners of the alleys stay free.',
		weiter: { pfad: '/formen/haus', text: 'This is where the forms take over.' }
	},
	{
		id: 'stadt',
		name: 'City',
		text: 'Existing stock, interventions and paths grow by the same rules on every grid.'
	}
];

export const startSchichten: SchichtId[] = ['bloecke', 'vierecke', 'stadt'];

export const vierecke: Abschnitt = {
	id: 'raster-vierecke',
	titel: 'Every polygon becomes quads',
	lead: 'So a building only needs to know quads, never the grid beneath them.'
};

export type Phase = { id: string; titel: string; text: string };

/** Title and sentence of a step; shared by City and Forms. */
export type Schritt = { titel: string; text: string };

export const teilungPhasen: Phase[] = [
	{
		id: 'dreieck',
		titel: 'Triangle',
		text: 'Place the center, halve the edges, connect: three quads.'
	},
	{
		id: 'quadrat',
		titel: 'Square',
		text: 'The same three steps produce four small squares.'
	},
	{ id: 'sechseck', titel: 'Hexagon', text: 'Six edges, six quads.' },
	{
		id: 'fuenfeck',
		titel: 'Free pentagon',
		text: 'Even a skewed polygon breaks down this way, corner by corner.'
	},
	{
		id: 'nachbarn',
		titel: 'Neighbors',
		text: 'Neighbors share the edge midpoint. That is how their quads fit together without a seam.'
	}
];

export const spielraum: Abschnitt = {
	id: 'raster-spielraum',
	titel: 'The mesh moves, the rules stay',
	lead: 'Distortion and smoothing move corners, never neighborhoods. Every quad keeps its neighbors, every building its place.'
};

export const spielraumPhasen: Phase[] = [
	{
		id: 'verziehen',
		titel: 'Warp',
		text: 'The whole mesh warps. No quad loses a neighbor.'
	},
	{
		id: 'mitwandern',
		titel: 'Move along',
		text: 'The buildings sit on their quads and move with them.'
	},
	{
		id: 'spielraum',
		titel: 'Leeway',
		text: 'Each corner may move as long as every angle of its quads stays between 5° and 180°. At the edge of that leeway, it stops.'
	}
];

export const ziehHinweis = 'Drag a corner. It follows until its leeway runs out.';
