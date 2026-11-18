/**
 * Interface chapter: section texts, building views and workbench motions,
 * HUD patterns, sample data for the UI controls. Pure data, no rendering.
 * Takes over focus 06–09 (building views, transformations, interface patterns, workbench),
 * icons and the UI controls of the old overview. Flow colors: data/focus.ts.
 */
import type { FlowId } from './focus';
import type { Box } from './iso';

export type Abschnitt = { id: string; titel: string; lead: string };

/* ── Opening a building (workbench) ─────────────────────── */

export const oeffnen: Abschnitt = {
	id: 'interface-haus',
	titel: 'Every building can be opened',
	lead: 'A building is a stack of floors around a core. That is why you can X-ray it, cut it open and pull it apart without changing anything about it.'
};

export type HausAnsichtId = 'aussen' | 'roentgen' | 'schnitt' | 'explosion' | 'geschoss';

/** A building view: what it shows and when you need it. Context info for the workbench. */
export type HausAnsicht = { id: HausAnsichtId; name: string; zeigt: string; wann: string };

export const hausAnsichten: HausAnsicht[] = [
	{
		id: 'aussen',
		name: 'Exterior',
		zeigt: 'Volume and facade, just as the building stands in the district.',
		wann: 'You need it when you place the building in its neighborhood.'
	},
	{
		id: 'roentgen',
		name: 'X-Ray',
		zeigt: 'The facade becomes an envelope; only the modules keep their material.',
		wann: 'You need it when you want to know what sits on which floor.'
	},
	{
		id: 'schnitt',
		name: 'Section',
		zeigt: 'A vertical plane cuts through core, floors, conduits and subsoil.',
		wann: 'You need it when a flow is routed through the building.'
	},
	{
		id: 'explosion',
		name: 'Exploded View',
		zeigt: 'The floors move apart along the core; each one lies exposed.',
		wann: 'You need it when you convert a floor or swap a module.'
	},
	{
		id: 'geschoss',
		name: 'Floor Plan',
		zeigt: 'One floor seen from above as a plan. Below it carries; above it becomes envelope.',
		wann: 'You need it when you lay out rooms.'
	}
];

/** Motions the workbench shows continuously. One sentence under each slider. */
export const bewegungen = {
	explodieren: 'Floors pull apart along the core.',
	verschieben: 'Modules slide out sideways; the core stays in place.',
	wachsen: 'Construction phases appear one after another, from existing stock to crown.'
} as const;

export const werkbankHinweis =
	'Drag to rotate. A click selects a module; it lights up in all three views.';

/* ── HUD ────────────────────────────────────────────────── */

export const hudAbschnitt: Abschnitt = {
	id: 'interface-hud',
	titel: 'Playing and planning share one image',
	lead: 'The HUD floats above the city and covers as little as possible. In planning, ink turns to blueprint: what you draw is not built yet.'
};

export type HudModus = 'play' | 'plan';

/** A HUD pattern; in the image it carries a number tag, its explanation sits on the right. */
export type HudMuster = {
	id: string;
	name: string;
	text: string;
	/** The modes in which the pattern appears in the image. */
	modi: HudModus[];
};

export const hudMuster: HudMuster[] = [
	{
		id: 'kopf',
		name: 'Metrics and time',
		text: 'Three district values at the top, the timeline with events at the bottom.',
		modi: ['play', 'plan']
	},
	{
		id: 'werkzeuge',
		name: 'Tools',
		text: 'A bar on the right; one tool is active.',
		modi: ['play', 'plan']
	},
	{
		id: 'fokus',
		name: 'Focus modes',
		text: 'The same modes as in the color lab: a question chooses which flows carry color.',
		modi: ['play', 'plan']
	},
	{
		id: 'beschriftung',
		name: 'Labels in space',
		text: 'A hairline leads from the building to its name.',
		modi: ['play']
	},
	{
		id: 'einschub',
		name: 'Inset',
		text: 'The selected building appears large in a view of its own.',
		modi: ['play']
	},
	{
		id: 'andocken',
		name: 'Grab and dock',
		text: 'A new module snaps onto the core; the preview is dashed.',
		modi: ['plan']
	},
	{
		id: 'inventar',
		name: 'Wishes and inventory',
		text: 'What residents wish for and which components deconstruction supplies.',
		modi: ['plan']
	}
];

/** Sample HUD values, in the terms of the game. */
export const hudDaten = {
	ort: 'Neustadt',
	quartier: 'Courtyard District',
	werte: [
		{ label: 'Residents', wert: '1,240' },
		{ label: 'Water from the district', wert: '82 %' },
		{ label: 'Trips under 15 minutes', wert: '94 %' }
	],
	haus: { name: 'Courtyard House North', text: 'Six floors, rooftop farm' },
	wuensche: [
		{ text: 'Market within walking distance', strom: 'food' as FlowId },
		{ text: 'Workshop in the plinth', strom: 'material' as FlowId }
	],
	inventar: [
		{ text: 'Windows', menge: '12' },
		{ text: 'Steel beams', menge: '4' },
		{ text: 'Facade panels', menge: '30 m²' }
	]
};

/**
 * District in the HUD: four old buildings around a courtyard (existing stock, gray), with new
 * additions on top and in between, per flow. Pedestrian paths run over the elevated walkway and
 * through the courtyard. Dimensions in meters (iso.ts).
 */
export type HudLot = { id: string; box: Box; strom?: FlowId };

export const hudQuartier: HudLot[] = [
	{ id: 'alt-nord', box: { x: 0, y: 0, z: 0, w: 24, d: 10, h: 14 } },
	{ id: 'alt-ost', box: { x: 28, y: 0, z: 0, w: 10, d: 30, h: 16 } },
	{ id: 'alt-west', box: { x: 0, y: 14, z: 0, w: 10, d: 20, h: 12 } },
	{ id: 'speicher', box: { x: 30, y: 32, z: 0, w: 7, d: 5, h: 5 }, strom: 'water' },
	{ id: 'alt-sued', box: { x: 14, y: 26, z: 0, w: 14, d: 8, h: 9 } },
	{ id: 'hofhaus', box: { x: 2, y: 1, z: 14, w: 14, d: 8, h: 12 }, strom: 'people' },
	{ id: 'solar', box: { x: 1, y: 15, z: 12, w: 8, d: 18, h: 0.6 }, strom: 'energy' },
	{ id: 'dachfarm', box: { x: 28.5, y: 1, z: 16, w: 9, d: 28, h: 1.2 }, strom: 'food' },
	{ id: 'hochweg', box: { x: 16, y: 4, z: 20, w: 12, d: 2, h: 0.8 }, strom: 'people' },
	{ id: 'werkstatt', box: { x: 16, y: 27, z: 9, w: 10, d: 6, h: 5 }, strom: 'material' }
];

/** The selected building: label, inset, docking. */
export const hudHaus = 'hofhaus';

/** Docking preview: one module on the selected building, dashed. */
export const hudAndocken: Box = { x: 4, y: 2, z: 26, w: 8, d: 6, h: 6 };

/** HUD timeline: years and events per flow. */
export const hudZeit = {
	label: 'Year',
	min: 2026,
	max: 2046,
	value: 2033,
	minor: 1,
	major: 5,
	ereignisse: [
		{ jahr: 2027, text: 'Rainwater tank in the courtyard', strom: 'water' as FlowId },
		{ jahr: 2029, text: 'North elevated walkway', strom: 'people' as FlowId },
		{ jahr: 2031, text: 'East rooftop farm', strom: 'food' as FlowId },
		{ jahr: 2036, text: 'Workshop in the plinth (planned)', strom: 'material' as FlowId }
	]
};

/** Tools in the bar. Tools act on the pedestrian city. */
export const hudWerkzeuge = [
	{ id: 'auswahl', label: 'Select' },
	{ id: 'bauen', label: 'Build' },
	{ id: 'wege', label: 'Paths' },
	{ id: 'gruen', label: 'Green' },
	{ id: 'ebenen', label: 'Levels' }
] as const;

export type HudWerkzeugId = (typeof hudWerkzeuge)[number]['id'];

/* ── Icons ──────────────────────────────────────────────── */

export const iconAbschnitt: Abschnitt = {
	id: 'interface-icons',
	titel: 'Every icon has a model in the city',
	lead: 'One grid, one pen: 24 units, 1.5-pixel stroke. Volumes stand in the axonometric view of the world, zones in section, flows as a flat sign. Controls are drawn by Lucide: of five libraries compared, it absorbs our own drawings in the same stroke most easily.'
};

export type IconFamilieId = 'konstruktion' | 'formen' | 'stroeme' | 'zonen' | 'kontext' | 'ui';

/** Families of the icon list: name in the filter and one sentence about the family. */
export const iconFamilien: { id: IconFamilieId; name: string; text: string }[] = [
	{
		id: 'konstruktion',
		name: 'Construction',
		text: 'The hairline is the axis, the band the stroke, the frame the drawing area.'
	},
	{
		id: 'formen',
		name: 'Forms',
		text: 'Every form group can take on the color of a flow when a component serves it. Existing stock and load-bearing structure stay neutral.'
	},
	{
		id: 'stroeme',
		name: 'Flows',
		text: 'On the left the line, on the right the same drawing in the color of the flow. The form alone is enough to recognize it.'
	},
	{
		id: 'zonen',
		name: 'Zones',
		text: 'Drawn in section: the area in ink shows which zone is meant.'
	},
	{
		id: 'kontext',
		name: 'Context',
		text: 'Every rule shows the component in question in ink, the rest as line.'
	},
	{
		id: 'ui',
		name: 'Controls',
		text: 'Controls are drawn by Lucide with the same stroke. A control icon never takes on a flow color.'
	}
];

/* ── UI controls ────────────────────────────────────────── */

export const bedienAbschnitt: Abschnitt = {
	id: 'interface-bedienung',
	titel: 'Controls like on the drafting table',
	lead: 'Paper, hairline, square edges. Every element looks drawn and responds like a tool: what is active turns to ink.'
};

/** A control on the panel: its name and its job in the game. */
export const bedienelemente: { id: string; name: string; rolle: string }[] = [
	{ id: 'knopf', name: 'Button', rolle: 'Triggers an action. The primary button is ink.' },
	{ id: 'schalter', name: 'Switch', rolle: 'Turns a view on or off.' },
	{ id: 'haken', name: 'Checkbox', rolle: 'Checks off a building’s tasks.' },
	{ id: 'regler', name: 'Slider', rolle: 'Sets a value on a ruler.' },
	{ id: 'reiter', name: 'Tab', rolle: 'Switches between parts of a panel.' },
	{ id: 'hinweis', name: 'Tooltip', rolle: 'Names the item and its shortcut when you point.' },
	{ id: 'marke', name: 'Tag', rolle: 'Counts and sorts without judging.' },
	{ id: 'kennzahl', name: 'Metric', rolle: 'A value with direction and time span.' },
	{ id: 'auswahl', name: 'Selection', rolle: 'A frame around the selection, color for its state.' },
	{ id: 'kacheln', name: 'Tiles', rolle: 'Five flows of a district at a glance.' },
	{ id: 'zeitleiste', name: 'Timeline', rolle: 'Years, events and epochs of the city.' }
];

/** Panel examples in the terms of the game (pedestrian access and shared provision). */
export const bedienBeispiele = {
	aufgaben: [
		{ id: 'wasser', label: 'Connect rain catcher', done: true },
		{ id: 'treppe', label: 'Link elevated walkway', done: true },
		{ id: 'farm', label: 'Plant rooftop farm', done: false }
	],
	reiter: [
		{ id: 'haus', label: 'Building' },
		{ id: 'stroeme', label: 'Flows' },
		{ id: 'umbau', label: 'Conversion' }
	],
	regler: {
		label: 'Greening',
		value: 40,
		step: 5,
		minor: 5,
		major: 25,
		format: (v: number) => `${v} %`
	},
	kennzahl: {
		label: 'Water from the district',
		value: '82',
		unit: '%',
		trend: 'up' as const,
		since: '2031'
	},
	marken: [{ text: 'Courtyard House North' }, { text: 'Planned', meta: '3' }],
	haus: { index: '03.2', name: 'Courtyard House North', bewohner: 120 },
	kacheln: [
		{ strom: 'people' as FlowId, value: '1,240', text: 'Residents', size: 'l' as const },
		{ strom: 'water' as FlowId, value: '82 %', text: 'Water', size: 'm' as const },
		{ strom: 'energy' as FlowId, value: '1.4', text: 'MWh per day', size: 'm' as const },
		{ strom: 'food' as FlowId, value: '31 %', text: 'Harvest', size: 'm' as const },
		{ strom: 'material' as FlowId, value: '68 %', text: 'Reused', size: 'm' as const }
	]
};

/* ── Type and page grid ────────────────────────────────── */

export const schriftAbschnitt: Abschnitt = {
	id: 'interface-schrift',
	titel: 'One typeface, one measure',
	lead: 'Geist sets page and game, Geist Mono only labels in space. Every measure is a multiple of ten pixels, in plan as in isometric view.'
};
