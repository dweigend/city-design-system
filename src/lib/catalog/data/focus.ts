/**
 * Focus system: color codes for flows, levels of representation for 3D models,
 * focus layers and focus modes. Applies equally to UI, icons, 3D and diagrams.
 * Shown in the color lab (page /farben). Building views and interface patterns: data/interface.ts.
 */

/* ── Flows ──────────────────────────────────────────────── */

/**
 * The meaning contract: flow → color, fixed, decided by the author on 2026-11-11.
 * The single source for flow colors in code; world, HUD, icon and diagram read only from here.
 * One palette for everything: flows have no colors of their own; they use
 * the website tokens (app.css). Depth comes from material, not from color.
 * Water blue, energy yellow, food green, material orange, people/housing/paths pink.
 * Circularity is not a flow of its own (author, 2026-11-12): every flow runs in a loop; deconstruction and
 * recyclables belong to Material. Blueprint stays the accent for planned work. Do not change without the author; the test data/color.test.ts pins it.
 * Rules and roles: data/color.ts and the page /farben.
 */
export const flowToken = {
	people: '--cat-business',
	water: '--cat-health',
	energy: '--cat-mobility',
	food: '--cat-nature',
	material: '--cat-living'
} as const;

export type FlowId = 'people' | 'water' | 'energy' | 'food' | 'material';

export type Flow = {
	id: FlowId;
	name: string;
	/** What belongs to it: networks, buildings, resources. */
	covers: string;
	/** Meaning of steps 1–5 within the color. */
	steps: [string, string, string, string, string];
	/** Second channel besides color (accessibility). */
	pattern: string;
};

export const flows: Flow[] = [
	{
		id: 'people',
		name: 'People',
		covers: 'Footpaths, squares, stairs, elevated walkways, rail, cable car',
		steps: ['Catchment', 'Square', 'Footpath', 'Elevated walkway', 'Rail'],
		pattern: 'Solid fill'
	},
	{
		id: 'water',
		name: 'Water',
		covers: 'Rain, storage, basins, graywater, pipes',
		steps: ['Infiltration', 'Basin', 'Rainwater', 'Pipe', 'Storage'],
		pattern: 'Wave'
	},
	{
		id: 'energy',
		name: 'Energy',
		covers: 'Solar, wind, storage, heat, lines',
		steps: ['Range', 'Heat', 'Line', 'Generation', 'Storage'],
		pattern: 'Zigzag'
	},
	{
		id: 'food',
		name: 'Food',
		covers: 'Rooftop farm, greenhouse, vertical farm, market, compost',
		steps: ['Green space', 'Garden', 'Farm', 'Greenhouse', 'Market'],
		pattern: 'Dots'
	},
	{
		id: 'material',
		name: 'Material',
		covers: 'Raw materials, components, goods, workshops, logistics, deconstruction, recyclables',
		steps: ['Depot', 'Component', 'Transport', 'Workshop', 'Raw material'],
		pattern: 'Hatching'
	}
];

/**
 * Steps 1–5 as ladder tokens from app.css. One name per step for all colors (gray included):
 * The names follow the role in the flow (see artStufe in the color lab): 1 Surroundings, 2 Surface,
 * 3 Volume, 4 Network (base tone), 5 Core (close to the ink, legible as text on paper).
 */
export const flowSteps = [
	{ step: 1, name: 'Surroundings' },
	{ step: 2, name: 'Surface' },
	{ step: 3, name: 'Volume' },
	{ step: 4, name: 'Network' },
	{ step: 5, name: 'Core' }
] as const;

export type FlowStep = (typeof flowSteps)[number]['step'];

/** Token of a step, e.g. flowStepToken('water', 3) = '--cat-health-3'. */
export const flowStepToken = (id: FlowId, step: FlowStep = 4): string =>
	step === 4 ? flowToken[id] : `${flowToken[id]}-${step}`;

/** CSS color of a step, e.g. flowColor('water', 3). */
export const flowColor = (id: FlowId, step: FlowStep = 4): string =>
	`var(${flowStepToken(id, step)})`;

/* ── Levels of representation ──────────────────────────── */

export type LevelId = 'detail' | 'mid' | 'block' | 'hull';

export type Level = {
	id: LevelId;
	name: string;
	geometry: string;
	surface: string;
	alpha: string;
	use: string;
};

/** Every 3D model supplies all four levels. The system chooses, not the model. */
export const levels: Level[] = [
	{
		id: 'detail',
		name: 'Detail',
		geometry: 'Full geometry: modules, stairs, railings, plants',
		surface: 'Material and color code, shadows',
		alpha: '--alpha-solid',
		use: 'Focus, close-up, selection'
	},
	{
		id: 'mid',
		name: 'Mid',
		geometry: 'Main volumes and modules, no small parts',
		surface: 'Surface color in three values, edges',
		alpha: '--alpha-solid',
		use: 'Focus from mid distance'
	},
	{
		id: 'block',
		name: 'Block',
		geometry: 'Bounding volume, one box per building volume',
		surface: 'Paper, pencil edge, hatching on the shadow side',
		alpha: '--alpha-solid',
		use: 'Context, wide zoom, existing stock'
	},
	{
		id: 'hull',
		name: 'Envelope',
		geometry: 'Bounding volume',
		surface: 'Edges only, surface almost transparent',
		alpha: '--alpha-hull',
		use: 'Background, occluding, planned'
	}
];

/* ── Focus layers ───────────────────────────────────────── */

export type LayerId = 'focus' | 'context' | 'background';

export type Layer = { id: LayerId; name: string; level: LevelId; color: string; rule: string };

/** Every object in the scene sits in exactly one layer. */
export const layers: Layer[] = [
	{
		id: 'focus',
		name: 'Focus',
		level: 'detail',
		color: 'Flow color by role, strong edge',
		rule: 'What you are working on right now'
	},
	{
		id: 'context',
		name: 'Context',
		level: 'block',
		color: 'Paper with pencil edge',
		rule: 'What gives you a footing'
	},
	{
		id: 'background',
		name: 'Background',
		level: 'hull',
		color: 'Envelope, almost transparent',
		rule: 'What only gives scale or gets in the way'
	}
];

/* ── Focus modes ────────────────────────────────────────── */

export type FocusModeId = 'bauen' | 'wege' | 'versorgung' | 'ernte' | 'rueckbau' | 'bestand';

/**
 * A focus mode answers a player's question. It colors at most three flows and
 * puts every part in one layer (Focus, Context, Background). Modes are activities, not
 * flows: "Deconstruction" shows Material, Energy and Water at once but has no color of its own.
 */
export type FocusMode = {
	id: FocusModeId;
	name: string;
	/** Flows in focus, at most three. Empty: the mode focuses on built work without a flow color. */
	flows: FlowId[];
	question: string;
	/** What sits in Focus, Context and Background, in the game's words. */
	ebenen: Record<LayerId, string>;
};

/** At most this many flow colors are in focus at the same time. */
export const MAX_FOKUS_STROEME = 3;

/** Layers of a flow mode: existing stock and core give a footing; the remaining new build recedes as an envelope. */
export const stromEbenen = (fokus: string): Record<LayerId, string> => ({
	focus: fokus,
	context: 'Existing stock and the tower core',
	background: 'remaining new build as an envelope'
});

export const focusModes: FocusMode[] = [
	{
		id: 'bauen',
		name: 'Build',
		flows: [],
		question: 'Where can I dock on?',
		ebenen: {
			focus: 'Structural frame and core, where the next floor docks on',
			context: 'Existing stock and modules as blocks',
			background: 'Pipes and surfaces as an envelope'
		}
	},
	{
		id: 'wege',
		name: 'Paths',
		flows: ['people'],
		question: 'Can everyone reach everything on foot?',
		ebenen: stromEbenen('Elevated walkway, stairs, square and courtyard')
	},
	{
		id: 'versorgung',
		name: 'Supply',
		flows: ['water', 'energy'],
		question: 'Is there enough water and energy?',
		ebenen: stromEbenen('Rain catchment, tank, solar roof and storage')
	},
	{
		id: 'ernte',
		name: 'Harvest',
		flows: ['food', 'water'],
		question: 'Does enough grow nearby?',
		ebenen: stromEbenen('Farm floors, roof garden, market and their water')
	},
	{
		id: 'rueckbau',
		name: 'Deconstruction',
		flows: ['material', 'energy', 'water'],
		question: 'What can be built in again?',
		ebenen: stromEbenen('Workshop, recyclables, depot and what powers them')
	},
	{
		id: 'bestand',
		name: 'Existing Stock',
		flows: [],
		question: 'What already stands, and what can be used?',
		ebenen: {
			focus: 'the four old buildings, drawn strongly',
			context: 'Tower core',
			background: 'everything new as an envelope'
		}
	}
];
