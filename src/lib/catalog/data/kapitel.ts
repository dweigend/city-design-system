/**
 * Structure of the design bible: nine chapters in reading order. Source for the header, signposts
 * and page titles. From the whole to the part: first the city, then what it is made of and how it
 * grows, then how the game shows it. The workshop (Lab, Archive) stands apart.
 * Paths are route IDs; the page resolves them with `resolve`. Text = the core message in one sentence.
 */
export type KapitelPfad =
	| '/'
	| '/formen'
	| '/raster'
	| '/wachstum'
	| '/farben'
	| '/material'
	| '/interface'
	| '/labor'
	| '/archiv';

export type Kapitel = { pfad: KapitelPfad; titel: string; text: string };
export type KapitelGruppe = { id: string; titel: string; text: string; kapitel: Kapitel[] };

export const kapitelGruppen: KapitelGruppe[] = [
	{
		id: 'bibel',
		titel: 'Bible',
		text: 'Binding rules. Every rule applies to the design language and the engine alike.',
		kapitel: [
			{
				pfad: '/',
				titel: 'City',
				text: 'Building on existing stock, paths above the alleys, rain and components in a closed loop.'
			},
			{
				pfad: '/formen',
				titel: 'Forms',
				text: 'Structures carry, forms fill: from the folded plate to the tower built from corners.'
			},
			{
				pfad: '/raster',
				titel: 'Grid',
				text: 'The city stands on any ground, from the checkerboard to the old town.'
			},
			{
				pfad: '/wachstum',
				titel: 'Growth',
				text: 'Paths first, then blocks: the city grows without a master plan.'
			},
			{
				pfad: '/farben',
				titel: 'Color',
				text: 'One color, one function. Five flows carry color; everything else stays quiet.'
			},
			{
				pfad: '/material',
				titel: 'Material',
				text: 'Color carries the function, material the depth.'
			},
			{
				pfad: '/interface',
				titel: 'Interface',
				text: 'Icons, UI controls and building views speak the language of the city.'
			}
		]
	},
	{
		id: 'werkstatt',
		titel: 'Workshop',
		text: 'Derivation and raw material. Everything is tested here before it becomes a rule.',
		kapitel: [
			{
				pfad: '/labor',
				titel: 'Lab',
				text: 'The whole city as a simulation, the principles behind it, open studies.'
			},
			{
				pfad: '/archiv',
				titel: 'Archive',
				text: 'Every image in one place: our own designs, raw material, external references.'
			}
		]
	}
];

/** The reading path in one sentence. */
export const leseweg =
	'City shows the whole. Forms build the building, Grid lays the ground, Growth distributes both. Color, Material and Interface decide how the same data appears. The workshop shows where every rule comes from.';
