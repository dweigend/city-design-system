/**
 * Material system: color says what something is (flow, function); material says how it is there.
 * Depth, calm and hierarchy come from five axes, each in a few fixed steps:
 * opacity, finish, milkiness, diffusion, edge rendering (plus a pattern as an identifier).
 * Pure data. Rule resolution: logic/parametrik/material.ts, shader: scene/material.ts.
 */
export type MaterialId =
	| 'concrete'
	| 'wood'
	| 'metal'
	| 'paper'
	| 'cork'
	| 'glaze'
	| 'acrylic'
	| 'membrane'
	| 'greenhouse'
	| 'glass'
	| 'ghost'
	| 'water';

/* ── Axes and steps ────────────────────────────────────── */

/** Opacity: the same four steps as the alpha tokens in app.css (a test checks they stay in sync). */
export const alphaSteps = { solid: 1, glass: 0.6, hull: 0.3, trace: 0.12 } as const;
export type AlphaStep = keyof typeof alphaSteps;

/**
 * Finish as tonal steps, not as light: contrast scales the three surface tones,
 * sheen softly brightens grazing surfaces, gloss adds a hard highlight and a gloss edge.
 */
export const finishSteps = {
	matt: { contrast: 0.7, sheen: 0, gloss: 0 },
	seidenmatt: { contrast: 1, sheen: 0.22, gloss: 0 },
	glanz: { contrast: 1.15, sheen: 0.1, gloss: 0.75 }
} as const;
export type FinishStep = keyof typeof finishSteps;

/** Milkiness: turbidity toward the paper color, stronger on grazing surfaces (Fresnel). */
export const milkSteps = { klar: 0, hauch: 0.22, milchig: 0.5, opal: 0.78 } as const;
export type MilkStep = keyof typeof milkSteps;

/**
 * Diffusion: what share of what lies behind shows through soft (blurred) instead of sharp,
 * and how soft (mip level of the frame buffer). Lines behind become lighter and softer.
 */
export const diffusionSteps = {
	keine: { share: 0, blur: 0 },
	weich: { share: 0.55, blur: 2.2 },
	stark: { share: 0.85, blur: 3.4 }
} as const;
export type DiffusionStep = keyof typeof diffusionSteps;

/** Edge rendering: share of paper in the ink and relative stroke width. null = no edge. */
export const edgeSteps = {
	tinte: { paper: 0, width: 1 },
	fein: { paper: 0.25, width: 0.7 },
	gedaempft: { paper: 0.62, width: 0.85 },
	keine: null
} as const;
export type EdgeStep = keyof typeof edgeSteps;

/**
 * How the flow color gets onto the material.
 * voll: color with the material's pigment. pastell: color heavily mixed with paper.
 * neutral: color at most as a hint (12 %, step 1). eigen: the material has a fixed color.
 */
export type ColorRule = 'voll' | 'pastell' | 'neutral' | 'eigen';

export type PatternId = 'schalung' | 'lamelle' | 'korn' | 'sprosse' | 'welle' | 'naht';

export type Tint = {
	/** Color mix for the neutral surface (token --paper), in sRGB like color-mix. */
	toward?: '--cat-living' | '--cat-health' | '--cat-nature';
	amount?: number;
	/** Share of ink (gray value). */
	ink?: number;
};

export type MaterialSpec = {
	id: MaterialId;
	name: string;
	/** Short description of the look. */
	look: string;
	group: 'opak' | 'durchscheinend' | 'durchsichtig';
	alpha: AlphaStep;
	finish: FinishStep;
	milk: MilkStep;
	diffusion: DiffusionStep;
	edge: EdgeStep;
	pattern: PatternId | null;
	color: ColorRule;
	/** Share of paper over the flow color (0 = full color). */
	pigment: number;
	/** Own tone without flow color. */
	tint: Tint;
	use: string;
	/** Archive numbers of the original references. */
	ref: string;
};

/* ── Vocabulary ─────────────────────────────────────────── */

export const materials: MaterialSpec[] = [
	{
		id: 'paper',
		name: 'White model',
		look: 'Plaster, paper model: matte, chalky, softly graded surfaces',
		group: 'opak',
		alpha: 'solid',
		finish: 'matt',
		milk: 'klar',
		diffusion: 'keine',
		edge: 'tinte',
		pattern: null,
		color: 'voll',
		pigment: 0.45,
		tint: {},
		use: 'Structure, decks, existing stock as blocks, colored render on plug-in modules',
		ref: '16, 19, 48, 120'
	},
	{
		id: 'concrete',
		name: 'Concrete',
		look: 'Light gray, matte, fine formwork joints',
		group: 'opak',
		alpha: 'solid',
		finish: 'matt',
		milk: 'klar',
		diffusion: 'keine',
		edge: 'tinte',
		pattern: 'schalung',
		color: 'voll',
		pigment: 0.4,
		tint: { ink: 0.13 },
		use: 'Cores, plinths, tubes and cylinders as storage',
		ref: '06, 09, 147'
	},
	{
		id: 'wood',
		name: 'Wood',
		look: 'Warm, satin, vertical slats',
		group: 'opak',
		alpha: 'solid',
		finish: 'seidenmatt',
		milk: 'klar',
		diffusion: 'keine',
		edge: 'tinte',
		pattern: 'lamelle',
		color: 'voll',
		pigment: 0.25,
		tint: { toward: '--cat-living', amount: 0.26, ink: 0.06 },
		use: 'Modules, facade cassettes, decks among greenery',
		ref: '06, 11, 24'
	},
	{
		id: 'cork',
		name: 'Cork',
		look: 'Granular, dull, darker than wood',
		group: 'opak',
		alpha: 'solid',
		finish: 'matt',
		milk: 'klar',
		diffusion: 'keine',
		edge: 'tinte',
		pattern: 'korn',
		color: 'voll',
		pigment: 0.2,
		tint: { toward: '--cat-living', amount: 0.42, ink: 0.2 },
		use: 'Single volumes as a material accent, insulation, workshop',
		ref: '12, 14'
	},
	{
		id: 'metal',
		name: 'Painted steel',
		look: 'Full color, satin, smooth paint skin',
		group: 'opak',
		alpha: 'solid',
		finish: 'seidenmatt',
		milk: 'klar',
		diffusion: 'keine',
		edge: 'tinte',
		pattern: null,
		color: 'voll',
		pigment: 0,
		tint: { ink: 0.3 },
		use: 'Stairs, bridges, frames, pipes: everything that carries a flow',
		ref: '06, 18, 22, 136'
	},
	{
		id: 'glaze',
		name: 'Ceramic glaze',
		look: 'Ceramics: rich color, hard highlight, bright gloss edge',
		group: 'opak',
		alpha: 'solid',
		finish: 'glanz',
		milk: 'klar',
		diffusion: 'keine',
		edge: 'tinte',
		pattern: null,
		color: 'voll',
		pigment: 0.08,
		tint: { ink: 0.03 },
		use: 'Crowns, roofs, one-offs: at most one glossy volume per building',
		ref: '24, 140'
	},
	{
		id: 'acrylic',
		name: 'Frosted acrylic',
		look: 'Frosted: pastel, lighter edges, what lies behind soft and pale',
		group: 'durchscheinend',
		alpha: 'hull',
		finish: 'seidenmatt',
		milk: 'milchig',
		diffusion: 'weich',
		edge: 'tinte',
		pattern: null,
		color: 'pastell',
		pigment: 0.5,
		tint: {},
		use: 'Envelopes, plug-in modules with visible interiors, climate skin over a colored core',
		ref: '16, 27, 48'
	},
	{
		id: 'membrane',
		name: 'Membrane',
		look: 'Pneumatic, soap film: opal, strongly scattering, seams instead of edges',
		group: 'durchscheinend',
		alpha: 'glass',
		finish: 'matt',
		milk: 'opal',
		diffusion: 'stark',
		edge: 'fein',
		pattern: 'naht',
		color: 'pastell',
		pigment: 0.65,
		tint: {},
		use: 'Envelopes only: domes, barrel vaults, cushions over gardens and squares',
		ref: '27, 140 (phenomenon: 63, 69, 77)'
	},
	{
		id: 'greenhouse',
		name: 'Greenhouse glass',
		look: 'Clear with a mullion grid, a hint of green',
		group: 'durchsichtig',
		alpha: 'hull',
		finish: 'glanz',
		milk: 'hauch',
		diffusion: 'keine',
		edge: 'fein',
		pattern: 'sprosse',
		color: 'neutral',
		pigment: 0.88,
		tint: { toward: '--cat-nature', amount: 0.14 },
		use: 'Gardens, rooftop farms, dome gardens',
		ref: '48, 147'
	},
	{
		id: 'glass',
		name: 'Clear glass',
		look: 'Almost invisible: only the edge and a hint of surface',
		group: 'durchsichtig',
		alpha: 'trace',
		finish: 'glanz',
		milk: 'klar',
		diffusion: 'keine',
		edge: 'tinte',
		pattern: null,
		color: 'neutral',
		pigment: 1,
		tint: {},
		use: 'Display case, protective hood, tubes: shows what is inside',
		ref: '16, 27'
	},
	{
		id: 'ghost',
		name: 'Ghost',
		look: 'White model, half transparent, milky, muted edge',
		group: 'durchscheinend',
		alpha: 'hull',
		finish: 'matt',
		milk: 'milchig',
		diffusion: 'weich',
		edge: 'gedaempft',
		pattern: null,
		color: 'neutral',
		pigment: 0.88,
		tint: { ink: 0.03 },
		use: 'Existing stock and background in focus, planning, deconstruction',
		ref: '43, 48, 120'
	},
	{
		id: 'water',
		name: 'Water',
		look: 'Blue from the water flow, glossy, wavy lines, the bottom shimmers through',
		group: 'durchscheinend',
		alpha: 'glass',
		finish: 'glanz',
		milk: 'hauch',
		diffusion: 'weich',
		edge: 'keine',
		pattern: 'welle',
		color: 'eigen',
		pigment: 0.55,
		tint: { toward: '--cat-health', amount: 0.45 },
		use: 'Basins, canals, storage; the edge comes from the bank',
		ref: '09, 140, 147'
	}
];

export const materialSpec = (id: MaterialId): MaterialSpec =>
	materials.find((m) => m.id === id) ?? materials[0];
