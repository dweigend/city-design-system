/** The five display levels of COLOR-6, from the subject to the omitted context. */
export const displayLevels = Object.freeze([
	'full',
	'silhouette',
	'transparent',
	'pencil',
	'hidden'
] as const);

/** One way to draw a subsystem: full detail and colour, a plain neutral box, a see-through
 * envelope, a pencil drawing, or nothing. */
export type DisplayLevel = (typeof displayLevels)[number];

/** Share of the bodies at the transparent level drawn in pencil instead, so the grey stock keeps
 * a lively mix of plain volumes and drawn buildings (COLOR-5). */
export const stockPencilShare = 1 / 6;

/** The focus choices in menu order, named in the owner's words. `subject` lists the subsystems
 * the choice puts in focus; a choice whose subject is absent is not offered. */
const choices = {
	all: { label: 'All', subject: [] },
	districts: { label: 'Districts', subject: ['detached', 'block', 'center'] },
	center: { label: 'Center', subject: ['center'] },
	block: { label: 'Blocks', subject: ['block'] },
	detached: { label: 'Houses', subject: ['detached'] },
	lattice: { label: 'Lattice', subject: ['lattice'] },
	height: { label: 'Height', subject: ['detached', 'block', 'center'], analysis: 'height' },
	landscape: { label: 'Terrain and water', subject: ['terrain', 'water'] }
} as const satisfies Record<
	string,
	Readonly<{ label: string; subject: readonly string[]; analysis?: 'height' }>
>;

/** A player question that decides the drawing of the whole city. */
export type FocusChoice = keyof typeof choices;
/** Focus choices in menu order. */
export const focusChoices = Object.freeze(Object.keys(choices) as FocusChoice[]);

type Row = Readonly<Record<FocusChoice, DisplayLevel>>;

/** The policy, one row per subsystem and one column per focus choice. A new subsystem
 * (houses, paths, supply lines, forest) is one more row; the projection reads its level here. */
const policy = {
	terrain: {
		all: 'full',
		districts: 'full',
		center: 'full',
		block: 'full',
		detached: 'full',
		lattice: 'full',
		height: 'full',
		landscape: 'full'
	},
	water: {
		all: 'full',
		districts: 'full',
		center: 'full',
		block: 'full',
		detached: 'full',
		lattice: 'full',
		height: 'full',
		landscape: 'full'
	},
	detached: {
		all: 'full',
		districts: 'full',
		center: 'transparent',
		block: 'transparent',
		detached: 'full',
		lattice: 'transparent',
		height: 'full',
		landscape: 'silhouette'
	},
	block: {
		all: 'full',
		districts: 'full',
		center: 'transparent',
		block: 'full',
		detached: 'transparent',
		lattice: 'transparent',
		height: 'full',
		landscape: 'silhouette'
	},
	center: {
		all: 'full',
		districts: 'full',
		center: 'full',
		block: 'transparent',
		detached: 'transparent',
		lattice: 'transparent',
		height: 'full',
		landscape: 'silhouette'
	},
	lattice: {
		all: 'full',
		districts: 'hidden',
		center: 'hidden',
		block: 'hidden',
		detached: 'hidden',
		lattice: 'full',
		height: 'hidden',
		landscape: 'hidden'
	}
} as const satisfies Record<string, Row>;

/** A part of the city that one focus switches as a whole. */
export type Subsystem = keyof typeof policy;
/** Subsystems in policy order. */
export const subsystems = Object.freeze(Object.keys(policy) as Subsystem[]);

/** Reads the display level of a subsystem under a focus choice. Throws RangeError for an
 * unknown choice or subsystem. */
export function readFocusLevel(choice: FocusChoice, subsystem: Subsystem): DisplayLevel {
	if (!Object.hasOwn(choices, choice)) throw new RangeError(`Unknown focus "${choice}"`);
	if (!Object.hasOwn(policy, subsystem)) throw new RangeError(`Unknown subsystem "${subsystem}"`);
	return policy[subsystem][choice];
}

/** Reads the label and the analysis colouring of a focus choice, if it has one. */
export function readFocusChoice(choice: FocusChoice) {
	if (!Object.hasOwn(choices, choice)) throw new RangeError(`Unknown focus "${choice}"`);
	const { label, ...rest } = choices[choice];
	return { label, analysis: 'analysis' in rest ? rest.analysis : undefined };
}

/** The choices worth offering for the subsystems a picture holds, in menu order: a choice needs
 * a present subject, and a choice that draws the present subsystems exactly like an earlier one
 * is left out. */
export function offerFocus(present: readonly Subsystem[]): FocusChoice[] {
	const seen = new Set<string>();
	return focusChoices.filter((choice) => {
		const { subject } = choices[choice];
		if (subject.length && !subject.some((part: Subsystem) => present.includes(part))) return false;
		const key = JSON.stringify([
			readFocusChoice(choice).analysis,
			present.map((part) => policy[part][choice])
		]);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}
