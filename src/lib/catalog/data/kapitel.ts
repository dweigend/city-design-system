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
	| '/formlabor'
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
				pfad: '/raster',
				titel: 'Grid',
				text: 'Contour-led ground quads and the 3D spatial grid: from the checkerboard to the organic city plan.'
			},
			{
				pfad: '/wachstum',
				titel: 'Growth',
				text: 'Paths first, then blocks: the city grows without a master plan.'
			},
			{
				pfad: '/formen',
				titel: 'Forms',
				text: 'Solid and void volumes in the grid, construction phases, structural families and corner assembly.'
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
				text: 'Building connections, the shared engine path, HUD patterns, icons and controls.'
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
				pfad: '/formlabor',
				titel: 'Form lab',
				text: 'L14: one primal form, eight types, morphing via sliders and seed.'
			},
			{
				pfad: '/archiv',
				titel: 'Archive',
				text: 'Shared library status, library principles (LIB-1–LIB-6) and every reference image in one place.'
			}
		]
	}
];

/** The reading path in one sentence. */
export const leseweg =
	'City shows the whole. Grid lays the ground and spatial envelope, Growth evolves it over time, Forms shape occupied and open volumes. Color, Material and Interface decide how the same data and connections appear. The workshop shows where every rule comes from.';
