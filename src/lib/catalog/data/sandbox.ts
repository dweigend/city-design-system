/**
 * Copy and choices of the city sandbox: tools, their options and the names of the terrain
 * zones. Declarative facts only; the rules live in logic/sandbox.
 */
export type SandboxToolId = 'look' | 'house' | 'line' | 'cover' | 'dig' | 'erase';

export type SandboxTool = {
	id: SandboxToolId;
	name: string;
	shortcut: string;
	/** One sentence on what a stroke does. */
	hint: string;
};

export const sandboxTools: SandboxTool[] = [
	{ id: 'look', name: 'Look', shortcut: 'V', hint: 'Drag to move the sheet, scroll to zoom.' },
	{
		id: 'house',
		name: 'House',
		shortcut: 'H',
		hint: 'Drag to add a story to each plot below the height limit.'
	},
	{
		id: 'line',
		name: 'Line',
		shortcut: 'L',
		hint: 'Drag a line across the grid. It rises on pillars and gets its stops.'
	},
	{ id: 'cover', name: 'Area', shortcut: 'A', hint: 'Drag to plant an area. It follows the grid.' },
	{
		id: 'dig',
		name: 'Dig',
		shortcut: 'D',
		hint: 'Drag to dig a harbor basin. The grid follows the new shore; houses in the way go to the store.'
	},
	{
		id: 'erase',
		name: 'Erase',
		shortcut: 'E',
		hint: 'Drag to take away: first a story, then the area, then lines and basins.'
	}
];

export type SandboxOption<T extends string> = {
	id: T;
	name: string;
	shortName?: string;
	/** The figure that carries the meaning besides color (second channel). */
	figure: string;
	/** CSS color of the swatch. */
	color: string;
};

/** Uses of a house. Order = number keys 1–5. Paths and rail keep the people color. */
export const sandboxUses: SandboxOption<'living' | 'water' | 'energy' | 'food' | 'material'>[] = [
	{ id: 'living', name: 'Living', figure: 'Ribbon window, dome', color: 'var(--body-living)' },
	{ id: 'water', name: 'Water', figure: 'Porthole, tank', color: 'var(--cat-health)' },
	{ id: 'energy', name: 'Energy', figure: 'Twin panels, sun dish', color: 'var(--cat-mobility)' },
	{ id: 'food', name: 'Food', figure: 'Glazing, greenhouse', color: 'var(--cat-nature)' },
	{
		id: 'material',
		name: 'Workshop',
		shortName: 'Work',
		figure: 'Gate, shed roof',
		color: 'var(--cat-living)'
	}
];

export const sandboxLines: SandboxOption<'viaduct' | 'capsule' | 'walkway'>[] = [
	{ id: 'viaduct', name: 'Elevated rail', figure: 'Beam, train', color: 'var(--cat-business)' },
	{ id: 'capsule', name: 'Capsule tube', figure: 'Tube, pods', color: 'var(--cat-business-2)' },
	{
		id: 'walkway',
		name: 'Walkway',
		figure: 'Footbridge, stairs and square',
		color: 'var(--cat-business)'
	}
];

export const sandboxCovers: SandboxOption<'forest' | 'field' | 'meadow'>[] = [
	{ id: 'forest', name: 'Forest', figure: 'Trees', color: 'var(--cat-nature)' },
	{ id: 'field', name: 'Field', figure: 'Furrows', color: 'var(--cat-nature-3)' },
	{ id: 'meadow', name: 'Meadow', figure: 'Dots', color: 'var(--cat-nature-2)' }
];

/** Names of the terrain zones for the readout. */
export const sandboxZones = {
	water: 'Water',
	floodplain: 'Floodplain',
	'lower-terrace': 'Lower terrace',
	scarp: 'Slope',
	'upper-terrace': 'Upper terrace',
	ridge: 'Ridge'
} as const;

/** Ordered building styles available from each inclusive epoch boundary. */
export const sandboxEpochs = [
	{ from: 1900, houseStyles: ['terrace'] },
	{ from: 2026, houseStyles: ['composed', 'megastructure', 'totem'] }
] as const;

export type BuildingMethod = (typeof sandboxEpochs)[number]['houseStyles'][number] | 'collage';

export const sandboxMethods: Record<
	BuildingMethod,
	{ name: string; shortcut: string; phase: number }
> = {
	terrace: { name: 'Terrace', shortcut: 'C', phase: 0 },
	collage: { name: 'Collage', shortcut: 'C', phase: 2 },
	composed: { name: 'Body', shortcut: 'C', phase: 2 },
	megastructure: { name: 'Carrier', shortcut: 'M', phase: 1 },
	totem: { name: 'Capsules', shortcut: 'T', phase: 3 }
};

/** Default generation length of the sandbox timeline, in years. */
export const sandboxGenerationYears = 25;

/** Starter town parameters. Distances in the carrier chart are in cells. */
export const townDefaults = {
	year: 2026,
	stockYear: 1900,
	cells: 210,
	centerMin: 0.4,
	centerRange: 0.2,
	frontageDepth: 2,
	gardenShare: 0.16,
	alongScale: 1.6,
	inlandRows: 7,
	depthPenalty: 1.5,
	maxFloors: 3
};

/** Player-facing explanations for rejected construction surveys. */
export const surveyMessages: Readonly<Record<string, string>> = {
	'stroke-failed': 'The edit could not finish. Try the stroke again.',
	'kernel-start-failed': 'Detailed roofs are unavailable. You can keep building.',
	'member-too-long':
		'This member exceeds the maximum length. Bring the wall bearings closer together.',
	'wall-layout-unresolved': 'No stable wall connection was found. Try a shorter stroke.',
	'unstable-frame': 'These walls cannot brace the carrier in every direction.',
	'invalid-roof': 'These roof footprints cannot support a surveyed frame.',
	'empty-survey': 'Drag across existing roofs to place a carrier.',
	'occupied-roof': 'This roof already carries a frame.',
	'span-disconnected': 'The gap between these roofs is too wide for a carrier.',
	'no-local-bay': 'This roof has no suitable wall bearing.',
	'no-dock-group': 'The carrier needs three clear capsule seats here.',
	'short-span': 'Extend the walkway to reach a second support.',
	'straight-three-blocks': 'Turn the walkway before it crosses a third block.',
	'buried-deck': 'The ground rises above this deck.',
	'unsupported-span': 'Move the supports so each span measures 6 to 18 meters.',
	'no-stair-route': 'The walkway needs a dry stair route at both ends.',
	'wet-support': 'The walkway needs dry ground under each support.',
	'occupied-path': 'A walkway already occupies this part of the route.'
};

/** Radius of a dug basin around its cell, meters. */
export const DIG_RADIUS_M = 9;

/** Maximum response times and accent spacing in milliseconds. */
export const sandboxMotion = { seatMs: 120, pillarStepMs: 30, responseMs: 300 };

/** Browser-synthesized cues. Frequencies are in Hz, durations in seconds, gains are linear. */
export const sandboxSounds = {
	ceramic: { wave: 'sine', hz: 392, seconds: 0.12, gain: 0.08 },
	carrier: { wave: 'triangle', hz: 740, seconds: 0.075, gain: 0.035 },
	pillar: { wave: 'triangle', hz: 520, seconds: 0.085, gain: 0.045 },
	stop: { wave: 'sine', hz: 195, seconds: 0.16, gain: 0.06 },
	growth: { wave: 'noise', hz: 1900, seconds: 0.16, gain: 0.024 },
	dig: { wave: 'noise', hz: 280, seconds: 0.2, gain: 0.033 },
	water: { wave: 'sine', hz: 173, seconds: 0.18, gain: 0.045 },
	erase: { wave: 'sine', hz: 392, seconds: 0.12, gain: 0.08, reverse: true },
	advance: { wave: 'noise', hz: 1100, seconds: 0.24, gain: 0.028 }
} as const;

/** A five-note scale in equal-tempered semitones, ordered from the first story. */
export const sandboxScale = [0, 2, 4, 7, 9] as const;
