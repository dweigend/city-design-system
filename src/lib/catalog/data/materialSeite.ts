/**
 * Bible page /material: families (the game's basic vocabulary), lab axes, sections
 * and loop steps. The axis steps and the game materials live in data/material.ts.
 */
import type { ColorRule, MaterialId } from './material';

/* ── Bible page /material ───────────────────────────────── */
/*
 * Storyline: a lab (nine families on four forms), then three explainer loops:
 * a recipe of six nodes (TSL), color × material, material steps back.
 * The families are the game's basic vocabulary; each points to a game material
 * (MaterialSpec) and takes over its steps as defaults.
 */

export type Abschnitt = { id: string; titel: string; lead: string };
export type Phase = { id: string; titel: string; text: string };
/** A loop step with a sentence below the image: what can be seen where. */
export type BildPhase = Phase & { bild: string };

export type FamilieId =
	| 'metall'
	| 'keramik'
	| 'beton'
	| 'kunststoff'
	| 'glas'
	| 'holz'
	| 'membran'
	| 'wasser'
	| 'bestand';

/** How rough the surface is: controls noise and the width of the highlight. */
export const rauheitSteps = {
	glatt: { rauschen: 0.45, glanzbreite: 0.006 },
	fein: { rauschen: 1, glanzbreite: 0.016 },
	grob: { rauschen: 1.8, glanzbreite: 0.04 }
} as const;
export type RauheitStep = keyof typeof rauheitSteps;

/** Noise: structure in the material, in meters. */
export type RauschArt = 'poren' | 'maser' | 'schliff' | 'glasur' | 'schlieren' | 'faser' | 'welle';
/** Joints: a recurring line, spacing in meters. */
export type FugenArt =
	| 'schalung'
	| 'lamelle'
	| 'paneel'
	| 'fliese'
	| 'sprosse'
	| 'naht'
	| 'geschoss'
	| 'fenster'
	| 'strom';

export type Familie = {
	id: FamilieId;
	name: string;
	/** Game material whose steps and color rule the family takes over. */
	material: MaterialId;
	/** What it is, in one sentence. */
	was: string;
	/** Role in the game, one sentence. */
	rolle: string;
	/** How the flow color reaches the material; overrides the game material's rule. */
	farbe?: ColorRule;
	rauheit: RauheitStep;
	rauschen: { art: RauschArt; massstab: number; staerke: number } | null;
	fugen: { art: FugenArt; abstand: number; staerke: number } | null;
	/** Why the chosen flow color does not reach this material (only for own color or no color). */
	ohneStrom?: string;
	/** One sentence per node in the builder: noise, joints, skin. */
	knoten: { rauschen: string; fugen: string; haut: string };
};

export const familien: Familie[] = [
	{
		id: 'metall',
		name: 'Metal',
		material: 'metal',
		was: 'Painted, brushed steel, smooth and thin.',
		rolle: 'Carries every flow: stairs, bridges, frames, conduits.',
		rauheit: 'glatt',
		rauschen: { art: 'schliff', massstab: 2.4, staerke: 0.07 },
		fugen: { art: 'paneel', abstand: 1.5, staerke: 0.22 },
		knoten: {
			rauschen: 'Stretched noise becomes a brush stroke.',
			fugen: 'Vertical joints divide the skin into panels.',
			haut: 'A soft sheen runs across the curve.'
		}
	},
	{
		id: 'keramik',
		name: 'Ceramics',
		material: 'glaze',
		was: 'Glazed clay: rich color, hard highlight.',
		rolle: 'Crowns the building: crowns, roofs, one-off pieces.',
		rauheit: 'glatt',
		rauschen: { art: 'glasur', massstab: 1.1, staerke: 0.05 },
		fugen: { art: 'fliese', abstand: 0.8, staerke: 0.2 },
		knoten: {
			rauschen: 'The glaze gathers in soft clouds.',
			fugen: 'A tile grid sets the scale.',
			haut: 'Highlight and bright edge: at most once per building.'
		}
	},
	{
		id: 'beton',
		name: 'Concrete',
		material: 'concrete',
		was: 'Light-gray exposed concrete with pores and formwork joints.',
		rolle: 'Holds everything together: cores, plinths, storage.',
		rauheit: 'grob',
		rauschen: { art: 'poren', massstab: 7, staerke: 0.1 },
		fugen: { art: 'schalung', abstand: 1.25, staerke: 0.2 },
		knoten: {
			rauschen: 'Fine noise and cell points become pores.',
			fugen: 'Horizontal joints every 1.25 meters: the formwork.',
			haut: 'Matte: the surfaces stay softly graded.'
		}
	},
	{
		id: 'kunststoff',
		name: 'Plastic',
		material: 'acrylic',
		was: 'Milky acrylic, frosted, in pastel.',
		rolle: 'Wraps: a climate skin over a colored core.',
		rauheit: 'fein',
		rauschen: { art: 'schlieren', massstab: 0.9, staerke: 0.04 },
		fugen: { art: 'paneel', abstand: 2, staerke: 0.12 },
		knoten: {
			rauschen: 'Hardly any texture: only light streaks.',
			fugen: 'Large panels, few joints.',
			haut: 'Milky and semi-transparent: what lies behind stays softly visible.'
		}
	},
	{
		id: 'glas',
		name: 'Glass',
		material: 'greenhouse',
		was: 'Clear glass with mullions, a hint of green.',
		rolle: 'Shows what is inside: greenhouse, display case, protective cover.',
		farbe: 'neutral',
		ohneStrom: 'Glass never carries a flow color: the color shows what is inside.',
		rauheit: 'glatt',
		rauschen: null,
		fugen: { art: 'sprosse', abstand: 1, staerke: 0.75 },
		knoten: {
			rauschen: 'Glass stays smooth.',
			fugen: 'Mullions carry the panes.',
			haut: 'Almost invisible: edge and reflection remain.'
		}
	},
	{
		id: 'holz',
		name: 'Wood',
		material: 'wood',
		was: 'Warm wood in vertical slats.',
		rolle: 'Builds modules and decks, especially in green areas.',
		rauheit: 'fein',
		rauschen: { art: 'maser', massstab: 1.6, staerke: 0.12 },
		fugen: { art: 'lamelle', abstand: 0.3, staerke: 0.16 },
		knoten: {
			rauschen: 'Warped rings become wood grain.',
			fugen: 'Slats spaced 30 centimeters apart.',
			haut: 'Satin: a quiet sheen at the edge.'
		}
	},
	{
		id: 'membran',
		name: 'Membrane',
		material: 'membrane',
		was: 'Tensioned foil, opal like a soap film.',
		rolle: 'Envelopes only: domes, barrel vaults, cushions over gardens.',
		rauheit: 'fein',
		rauschen: { art: 'faser', massstab: 3, staerke: 0.05 },
		fugen: { art: 'naht', abstand: 1.5, staerke: 0.22 },
		knoten: {
			rauschen: 'A fine weave lies within the foil.',
			fugen: 'Seams instead of edges.',
			haut: 'Opal: light scatters, what lies behind blurs.'
		}
	},
	{
		id: 'wasser',
		name: 'Water',
		material: 'water',
		was: 'Moving water with ripples and gloss.',
		rolle: 'Fills basins, canals and storage; the edge comes from the waterfront.',
		ohneStrom: 'Water brings its own blue.',
		rauheit: 'fein',
		rauschen: { art: 'welle', massstab: 0.8, staerke: 0.14 },
		fugen: { art: 'strom', abstand: 0.9, staerke: 0.3 },
		knoten: {
			rauschen: 'Noise that drifts over time becomes a ripple.',
			fugen: 'Bright lines move with the current.',
			haut: 'Glossy and translucent.'
		}
	},
	{
		id: 'bestand',
		name: 'Existing stock',
		material: 'paper',
		was: 'White model like plaster: what already stands.',
		rolle: 'Carries the city. Stays colorless, matte, with a quiet edge.',
		farbe: 'neutral',
		ohneStrom: 'Existing stock never carries a flow color.',
		rauheit: 'fein',
		rauschen: { art: 'poren', massstab: 4, staerke: 0.03 },
		fugen: { art: 'fenster', abstand: 3, staerke: 0.22 },
		knoten: {
			rauschen: 'A hint of plaster, nothing more.',
			fugen: 'Windows on a three-meter grid: a building from earlier times.',
			haut: 'Matte like plaster. Where it obscures, it becomes a ghost.'
		}
	}
];

export const familie = (id: FamilieId): Familie => familien.find((f) => f.id === id) ?? familien[0];

/** Lab axes: named steps for the controls. */
export const achsenWahl = {
	rauheit: [
		{ value: 'glatt', label: 'Smooth' },
		{ value: 'fein', label: 'Fine' },
		{ value: 'grob', label: 'Coarse' }
	],
	glanz: [
		{ value: 'matt', label: 'Matte' },
		{ value: 'seidenmatt', label: 'Satin' },
		{ value: 'glanz', label: 'Gloss' }
	],
	deckkraft: [
		{ value: 'solid', label: 'Solid' },
		{ value: 'glass', label: 'Glass' },
		{ value: 'hull', label: 'Envelope' },
		{ value: 'trace', label: 'Trace' }
	],
	kante: [
		{ value: 'tinte', label: 'Ink' },
		{ value: 'fein', label: 'Fine' },
		{ value: 'gedaempft', label: 'Muted' },
		{ value: 'keine', label: 'None' }
	]
} as const;

export type FormId = 'box' | 'kuppel' | 'turm' | 'bestand';
export const formWahl: { value: FormId; label: string }[] = [
	{ value: 'box', label: 'Box' },
	{ value: 'kuppel', label: 'Dome' },
	{ value: 'turm', label: 'Tower' },
	{ value: 'bestand', label: 'Existing stock' }
];

/* ── Sections ── */

export const familienAbschnitt: Abschnitt = {
	id: 'material-familien',
	titel: 'Every material has a job',
	lead: 'Metal, ceramics, concrete and plastic build the new. Glass, wood, membrane and water complement them; existing stock stays white. Color comes from the flow a component carries.'
};

export const rezeptAbschnitt: Abschnitt = {
	id: 'material-rezept',
	titel: 'A material is made of six nodes',
	lead: 'No material is a photo. Each is a small program in TSL, the shader language of three.js: a few nodes, wired up step by step. That is why it looks the same on every form, at every size, in light and dark mode alike.'
};

export const farbeAbschnitt: Abschnitt = {
	id: 'material-farbe',
	titel: 'Color carries function, material carries depth',
	lead: 'Color says which flow a component carries. Material says how close, how heavy and how important it is. The two change independently of each other.'
};

export const stufenAbschnitt: Abschnitt = {
	id: 'material-stufen',
	titel: 'Material steps back when it is not needed',
	lead: 'Up close at the node, a structure shows grain, brushing and gloss. From afar, color and edge remain. And where the envelope hides the structure behind it, it becomes a ghost.'
};

/* ── Loops ── */

export type KnotenId = 'ton' | 'farbe' | 'rauschen' | 'fugen' | 'kante' | 'haut';

export const rezeptPhasen: (Phase & { id: KnotenId })[] = [
	{
		id: 'ton',
		titel: 'Tone',
		text: 'Each surface takes its tone from its orientation. Light on top, graded on the sides, no lighting.'
	},
	{
		id: 'farbe',
		titel: 'Color',
		text: 'The flow color is added, mixed with the paper according to the material’s rule.'
	},
	{ id: 'rauschen', titel: 'Noise', text: 'Noise in space gives the material its grain.' },
	{ id: 'fugen', titel: 'Joints', text: 'Recurring lines set the scale.' },
	{ id: 'kante', titel: 'Edge', text: 'Edges and outline draw the form as if in ink.' },
	{ id: 'haut', titel: 'Skin', text: 'Gloss, turbidity and opacity turn it into the material.' }
];

/** Families the builder plays through (the four that build the new), each with one flow. */
export const rezeptFamilien: {
	id: FamilieId;
	strom: 'people' | 'water' | 'energy' | 'material';
}[] = [
	{ id: 'beton', strom: 'material' },
	{ id: 'metall', strom: 'people' },
	{ id: 'keramik', strom: 'water' },
	{ id: 'kunststoff', strom: 'energy' }
];

/** Postscript in the builder's deep dive. */
export const rezeptVertiefung =
	'One recipe, two targets: three.js translates the same nodes into WGSL for WebGPU and into GLSL for WebGL 2. All dimensions are meters on the world position, so there are no seams. blatt is the world position in the image plane; strich, fenster, umriss, glanzpunkt and unscharf are small, anti-aliased helper nodes. The stage also draws straight edges as lines.';

/** Sentence below the lab when a family sits on existing stock. */
export const bestandHinweis =
	'The old building stays a white model. The material applies only to what is newly added.';

export type FarbePhaseId = 'material' | 'farbe' | 'haus';
export const farbePhasen: (BildPhase & { id: FarbePhaseId })[] = [
	{
		id: 'material',
		titel: 'Material changes',
		text: 'Water four times: metal carries it, ceramics crowns, plastic wraps, concrete stores.',
		bild: 'From left: metal, ceramics, plastic, concrete. All four carry water, so all four are blue.'
	},
	{
		id: 'farbe',
		titel: 'Color changes',
		text: 'Metal five times: the same material carries each of the five flows.',
		bild: 'From left: People, Water, Energy, Food, Material. The same depth five times, five functions.'
	},
	{
		id: 'haus',
		titel: 'One building',
		text: 'Together: concrete carries, metal provides access, plastic wraps, ceramics crowns.',
		bild: 'A concrete plinth without a flow, topped by a metal energy core in a plastic envelope. The stair carries People; the ceramic crown stores Water.'
	}
];

export type StufePhaseId = 'nah' | 'mittel' | 'fern' | 'linie' | 'geist';
