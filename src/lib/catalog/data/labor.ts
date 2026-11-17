/**
 * Lab: full simulation with presets, "How the city computes" (layers and twelve
 * principles, each with its experiment) and two standalone operator studies.
 * Source: docs/research/05-bible-structure.md §5.
 */
export type Abschnitt = { id: string; titel: string; lead?: string };

export const simulation: Abschnitt = {
	id: 'labor-simulation',
	titel: 'The whole city in one simulation',
	lead: 'Grid, existing stock, interventions, elevated walkways and cycles compute together here. Pick a preset or turn any slider yourself.'
};

/** Every preset first resets everything to the defaults, then applies its own values. */
export const voreinstellungen = [
	{
		id: 'quartier',
		name: 'District',
		text: 'Four by four blocks on a square grid: gray existing stock, colored interventions, elevated walkways over the alleys.',
		welt: {}
	},
	{
		id: 'gewachsen',
		name: 'Organic ground',
		text: 'The same district on organic ground. The rules stay; only the corners sit differently.',
		welt: { raster: 'organisch' as const, verzug: 0.35, relax: 3 }
	},
	{
		id: 'dicht',
		name: 'Dense and tall',
		text: 'More interventions, stacked higher. The existing stock stays; the new grows on top of it and in between.',
		welt: { dichte: 0.9, hoehe: 0.9 }
	},
	{
		id: 'schwamm',
		name: 'Sponge city',
		text: 'Every open surface holds water. Basins, gardens and water floors increase; the bar under the image shows how much of its own demand the district covers.',
		welt: { schwamm: 1 }
	},
	{
		id: 'netze',
		name: 'Networks',
		text: 'Volumes step back; the existing stock turns transparent. Paths, runs and pipes remain. The city is the same; only the view changes.',
		welt: { fokus: 'netze' as const },
		glas: true
	},
	{
		id: 'massstab',
		name: 'Large blocks',
		text: 'Blocks of 39 instead of 30 m. Floors, footbridges and stairs keep their size in meters.',
		welt: { mass: 1.3 }
	},
	{
		id: 'rundgang',
		name: 'Walkthrough',
		text: 'At eye level from the ground, over stairs and elevated walkways, and back down again.',
		welt: {},
		ansicht: 'rundgang' as const,
		abspielen: true
	}
];

export type Voreinstellung = (typeof voreinstellungen)[number];

/** Color codes without study numbers; only "Flows" is a rule, the others are style studies. */
export const farbcodeNamen: Record<string, string> = {
	strom: 'Flows',
	'45': 'Two tones',
	'36': 'Three tones',
	'43': 'One signal'
};

export const rechnen: Abschnitt = {
	id: 'labor-rechnen',
	titel: 'How the city computes',
	lead: 'The engine stores meaning, neighborhood and position. The image derives from them and never writes back. Twelve principles hold this together, each with an experiment.'
};

export type Experiment =
	| {
			art: 'kapitel';
			pfad: '/wachstum' | '/raster' | '/formen/haus' | '/';
			anker?: string;
			name: string;
	  }
	| { art: 'simulation'; voreinstellung: string; name: string }
	| { art: 'studie'; anker: string; name: string };

/** One experiment per principle: in the chapter where it lives, or here in the simulation. */
export const experimente: Record<string, Experiment> = {
	U1: {
		art: 'kapitel',
		pfad: '/',
		anker: 'hochwege',
		name: 'City: Elevated walkways connect every building'
	},
	U2: { art: 'kapitel', pfad: '/formen/haus', name: 'Forms: The corners choose the module' },
	U3: {
		art: 'kapitel',
		pfad: '/wachstum',
		anker: 'wachstum-wfc',
		name: 'Growth: Where much fits, the neighborhood decides'
	},
	U4: {
		art: 'kapitel',
		pfad: '/wachstum',
		anker: 'wachstum-felder',
		name: 'Growth: Fields set the direction'
	},
	U5: {
		art: 'kapitel',
		pfad: '/wachstum',
		anker: 'wachstum-teilen',
		name: 'Growth: A block splits'
	},
	U6: { art: 'studie', anker: 'labor-studien', name: 'Two studies on the form family, below' },
	U7: {
		art: 'kapitel',
		pfad: '/raster',
		anker: 'raster-spielraum',
		name: 'Grid: The mesh moves, the rules stay'
	},
	U8: {
		art: 'kapitel',
		pfad: '/wachstum',
		anker: 'wachstum-parzellen',
		name: 'Growth: Parcels over time'
	},
	U9: { art: 'simulation', voreinstellung: 'rundgang', name: 'Walkthrough of the simulation' },
	U10: { art: 'simulation', voreinstellung: 'netze', name: 'Simulation: show only the networks' },
	M1: { art: 'simulation', voreinstellung: 'massstab', name: 'Simulation: large blocks' },
	M2: {
		art: 'kapitel',
		pfad: '/wachstum',
		anker: 'wachstum-parzellen',
		name: 'Growth: Leftover areas in the acute block'
	}
};

export const studien: Abschnitt = {
	id: 'labor-studien',
	titel: 'Two studies on the form family',
	lead: 'These experiments stand on their own and belong to no chapter. They test how far a form can be repeated and bent before it leaves its family.'
};

export const studienListe = [
	{
		id: 'wiederholung',
		name: 'Repetition with variation',
		text: 'The same capsule, placed several times on a carrier. The spread changes the height of each instance; your eye decides whether the row still reads as a family.'
	},
	{
		id: 'pfad',
		name: 'Profile along a path',
		text: 'A cross-section runs along a curve, like a pipe, a footbridge or a tube transit line. More curve points make the path restless; the radius makes the profile thicker.'
	}
] as const;

export const leitstil: Abschnitt = {
	id: 'labor-leitstil',
	titel: 'One building, one grammar',
	lead: 'Zoom, task and situation change the rendering. Envelope, structure and existing stock keep their roles.'
};
