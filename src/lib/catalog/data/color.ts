/**
 * Color system of the Bible (page /farben). One palette: the tokens in app.css.
 * Color carries meaning; depth comes from material. Flow colors are fixed in
 * flowToken (data/focus.ts); this file holds only ramps, texts and the design rules table.
 * One naming system: every ramp (gray included) has five steps with the same names
 * (flowSteps), between background (--paper) and ink (--ink).
 * Focus (at most three flows, three layers, modes) has belonged to Color since the restructure of 2026-11-12.
 * Sources: docs/research/04-city-rules.md §3.3,
 * blender/README.md (target style A, "architectural drawing").
 */
import {
	MAX_FOKUS_STROEME,
	flowStepToken,
	flowSteps,
	flowToken,
	flows,
	layers,
	type FlowId
} from './focus';

/* ── Quantity: three quarters stay quiet ──────────────────── */

/** Quantity rule as a share of the image area (focus "All"). Sum 100. */
export type Share = { id: 'ruhig' | 'funktion' | 'signal'; label: string; share: number };

export const shares: Share[] = [
	{ id: 'ruhig', label: 'Background and gray', share: 75 },
	{ id: 'funktion', label: 'Flow color', share: 20 },
	{ id: 'signal', label: 'Signal', share: 5 }
];

export const ruhig = {
	titel: 'One color, one function',
	lead: 'Color gives orientation. Each color stands for exactly one function of the city. The game asks what you want to know and colors at most three flows for it. Everything else steps back: as a pencil drawing that gives you a footing, or as an envelope you see through.',
	bild: 'Existing stock stays colorless. Every flow runs in a loop; its packets travel out and back. Drag to rotate, scroll to zoom.'
};

/* ── Ramps: each color belongs to exactly one flow ────────── */

/** One row of the palette: five steps, step 1 close to the background, step 5 close to the ink. */
export type Farbreihe = {
	id: 'grau' | FlowId;
	name: string;
	/** One example from the game, not a catalog. */
	beispiel: string;
	/** Tokens of steps 1–5. */
	tokens: [string, string, string, string, string];
};

/** Ends of every ramp: background and ink. In dark mode they swap their lightness. */
export const enden = { hintergrund: '--paper', schrift: '--ink' } as const;

const beispiel: Record<FlowId, string> = {
	people: 'Paths and squares',
	water: 'Rain and storage',
	energy: 'Solar and heat',
	food: 'Gardens and farms',
	material: 'Components, deconstruction, recyclables'
};

export const grau: Farbreihe = {
	id: 'grau',
	name: 'Gray',
	beispiel: 'Existing stock, lines, secondary text',
	tokens: ['--paper-2', '--paper-3', '--line', '--ink-3', '--ink-2']
};

export const reihen: Farbreihe[] = [
	grau,
	...flows.map((f) => ({
		id: f.id,
		name: f.name,
		beispiel: beispiel[f.id],
		tokens: ([1, 2, 3, 4, 5] as const).map((s) => flowStepToken(f.id, s)) as Farbreihe['tokens']
	}))
];

/** Accents: strong, rare, without a ladder. -1 and -5 only for selection fill and text. */
export type Akzent = {
	id: 'signal' | 'hazard' | 'blueprint';
	name: string;
	token: string;
	text: string;
};

export const akzente: Akzent[] = [
	{ id: 'signal', name: 'Signal', token: '--signal', text: 'marks selection and structural frame' },
	{ id: 'blueprint', name: 'Blueprint', token: '--blueprint', text: 'marks planned work' },
	{
		id: 'hazard',
		name: 'Hazard',
		token: '--cat-hazard',
		text: 'shows conflicts, always with a symbol'
	}
];

export const stroeme = {
	titel: 'Five flows, five steps',
	lead: 'Light tones color large surfaces; dark tones mark the core, such as a storage tank.',
	akzente: 'Two accents have no color ramp:'
};

/* ── Design rules (reference at the end of the page) ────────── */

/** One row of the design rules: like library docs, values and tokens only here. */
export type Designregel = { bereich: string; regel: string; wert: string; token: string };

const ANTEIL = Object.fromEntries(shares.map((s) => [s.id, s.share])) as Record<
	Share['id'],
	number
>;

/** Flow → base tone, generated from flowToken: the contract lives only in data/focus.ts. */
const stromZeilen: Designregel[] = flows.map((f) => ({
	bereich: 'Mapping',
	regel: f.name,
	wert: beispiel[f.id],
	token: flowToken[f.id]
}));

/**
 * All color rules in one place, phrased positively. Contrast values are lower bounds,
 * checked in logic/farbe/palette.test.ts for light and dark.
 */
export const designregeln: Designregel[] = [
	{
		bereich: 'Quantity',
		regel: 'Quiet surface per image',
		wert: `at least ${ANTEIL.ruhig}%`,
		token: '--paper, gray'
	},
	{
		bereich: 'Quantity',
		regel: 'Flow color per image',
		wert: `at most ${ANTEIL.funktion}%`,
		token: 'Flow colors'
	},
	{
		bereich: 'Quantity',
		regel: 'Signal per image',
		wert: `at most ${ANTEIL.signal}%`,
		token: '--signal'
	},
	{
		bereich: 'Quantity',
		regel: 'Measurement in the color lab',
		wert: 'visible surfaces seen obliquely from above (30°), weighted by opacity, without occlusion',
		token: '—'
	},
	{
		bereich: 'Focus',
		regel: 'Flow colors at once',
		wert: `at most ${MAX_FOKUS_STROEME}, depending on the focus mode`,
		token: 'Flow colors'
	},
	...layers.map((l) => ({
		bereich: 'Focus',
		regel: `Layer ${l.name}`,
		wert: l.color,
		token:
			l.id === 'background'
				? '--alpha-hull'
				: l.id === 'context'
					? '--paper, --ink-3'
					: 'Flow color, --ink'
	})),
	...stromZeilen,
	{ bereich: 'Mapping', regel: 'Colors per part', wert: '1', token: '—' },
	{
		bereich: 'Mapping',
		regel: 'Color choice',
		wert: 'fixed per flow, never random; set on 2026-11-11',
		token: 'flowToken'
	},
	{
		bereich: 'Steps',
		regel: 'Steps per ramp',
		wert: flowSteps.map((s) => s.name).join(', '),
		token: '-1, -2, -3, base tone, -5'
	},
	{
		bereich: 'Steps',
		regel: 'Base tone',
		wert: `Step 4, ${flowSteps[3].name}`,
		token: flowToken.water
	},
	{
		bereich: 'Steps',
		regel: 'Derivation',
		wert: 'one OKLCH formula for all families, from the base tone toward the background or the ink',
		token: '--step-1 … --step-5'
	},
	{
		bereich: 'Steps',
		regel: 'Ends of every ramp',
		wert: 'Background and ink',
		token: `${enden.hintergrund}, ${enden.schrift}`
	},
	{
		bereich: 'Steps',
		regel: 'Gray',
		wert: 'the same five steps',
		token: grau.tokens.join(', ')
	},
	{
		bereich: 'Steps',
		regel: 'Dark mode',
		wert: 'The color ramp flips; step 1 stays close to the background',
		token: "[data-theme='dark']"
	},
	{
		bereich: 'Existing stock',
		regel: 'Old building',
		wert: 'colorless, gray edge',
		token: '--paper, --ink-3'
	},
	{ bereich: 'Accents', regel: 'Columns, beams, crown detail', wert: 'Ink', token: '--ink' },
	...akzente.map((a) => ({
		bereich: 'Accents',
		regel: a.name,
		wert: a.text.replace(/^marks |^shows /, ''),
		token: a.id === 'blueprint' ? a.token : `${a.token}, ${a.token}-1, ${a.token}-5`
	})),
	{
		bereich: 'Contrast',
		regel: 'Ink on background',
		wert: 'at least 7 : 1',
		token: '--ink'
	},
	{
		bereich: 'Contrast',
		regel: 'Secondary text',
		wert: 'at least 4.5 : 1 on all paper steps',
		token: '--ink-2'
	},
	{ bereich: 'Contrast', regel: 'Existing stock line', wert: 'at least 3 : 1', token: '--ink-3' },
	{ bereich: 'Contrast', regel: 'Core as text', wert: 'at least 4.5 : 1', token: 'Step -5' },
	{
		bereich: 'Contrast',
		regel: 'Text on flow surface',
		wert: 'at least 4.5 : 1',
		token: '--on-cat'
	},
	{
		bereich: 'Contrast',
		regel: 'Text on accent',
		wert: 'at least 4.5 : 1',
		token: '--on-accent'
	},
	{
		bereich: 'Contrast',
		regel: 'Distance between meanings',
		wert: 'ΔE (OKLab) at least 0.08 between flows, signal and hazard',
		token: '—'
	},
	{
		bereich: 'Contrast',
		regel: 'Color space',
		wert: 'all tones within the sRGB gamut',
		token: '—'
	},
	{
		bereich: 'Legibility',
		regel: 'Second cue',
		wert: 'Shape, pattern or symbol alongside color',
		token: '—'
	},
	{ bereich: 'Legibility', regel: 'Color area', wert: 'contiguous', token: '—' },
	{
		bereich: 'Depth',
		regel: 'Depth and transparency',
		wert: 'through material, never through a second color',
		token: '--alpha-solid, --alpha-glass, --alpha-hull'
	},
	{ bereich: 'Layers', regel: 'Decoration and function', wert: 'separate layers', token: '—' },
	{
		bereich: 'Source',
		regel: 'All colors',
		wert: 'one palette for world, HUD, icons and page',
		token: 'app.css'
	}
];
