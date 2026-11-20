/**
 * Palette as data: reads the color tokens from the text of app.css (headless, without DOM).
 * app.css stays the single source; this file only recalculates (contrast, gamut, steps).
 * Expected form: `--name: oklch(L C H);` and `--step-n: calc(l + (T - l) * K) <chroma> h;`
 * with chroma `calc(c * M)` or `min(calc(c * M), MAX)`.
 */
import { applyStep, mixOklab, type Oklch, type StepRule } from './oklch';

export type Mode = 'light' | 'dark';
export type Step = 1 | 2 | 3 | 4 | 5;
export const STEPS: Step[] = [1, 2, 3, 4, 5];

export type ParsedPalette = {
	mixes: Record<Mode, ReturnType<typeof readMixes>>;
	/** Base tones per mode; dark inherits everything the dark block does not set. */
	base: Record<Mode, Record<string, Oklch>>;
	rules: Record<Mode, Partial<Record<Step, StepRule>>>;
	/** Ramp tokens such as `--cat-health-3` → base token and step. */
	ladder: { token: string; base: string; step: Step }[];
};

const BASE = /(--[\w-]+):\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)\s*;/g;
const RULE =
	/--step-(\d):\s*calc\(l \+ \(([\d.]+) - l\) \* ([\d.]+)\)\s+(?:min\(calc\(c \* ([\d.]+)\),\s*([\d.]+)\)|calc\(c \* ([\d.]+)\))\s+h\s*;/g;
const LADDER = /(--[\w-]+):\s*oklch\(from var\((--[\w-]+)\) var\(--step-(\d)\)\)\s*;/g;

function block(css: string, selector: RegExp): string {
	const m = selector.exec(css);
	if (!m) throw new Error(`Block missing: ${selector}`);
	const start = css.indexOf('{', m.index) + 1;
	return css.slice(start, css.indexOf('}', start));
}

function readBase(text: string): Record<string, Oklch> {
	return Object.fromEntries(
		[...text.matchAll(BASE)].map((m) => [m[1], { l: +m[2], c: +m[3], h: +m[4] }])
	);
}

// The stylesheet gives one percentage in each opaque two-token OKLab mix.
const MIX =
	/(--[\w-]+):\s*color-mix\(in oklab,\s*var\((--[\w-]+)\)(?:\s+([\d.]+)%)?,\s*var\((--[\w-]+)\)(?:\s+([\d.]+)%)?\)\s*;/g;

function readMixes(text: string) {
	return Object.fromEntries(
		[...text.matchAll(MIX)].map(
			([, token, first, firstPercent, second, secondPercent]) =>
				[
					token,
					{
						first,
						second,
						share: secondPercent ? +secondPercent / 100 : 1 - +(firstPercent ?? 50) / 100
					}
				] as const
		)
	);
}

function readRules(text: string): Partial<Record<Step, StepRule>> {
	return Object.fromEntries(
		[...text.matchAll(RULE)].map((m) => [
			+m[1],
			{
				toward: +m[2],
				k: +m[3],
				chroma: +(m[4] ?? m[6]),
				...(m[5] ? { maxChroma: +m[5] } : {})
			}
		])
	);
}

/** Reads literals, ramp steps and two-token OKLab mixes from the theme declarations. */
export function parsePalette(css: string): ParsedPalette {
	const light = block(css, /:root,\s*\[data-theme\]\s*\{/);
	const dark = block(css, /\[data-theme='dark'\]\s*\{/);
	const lightBase = readBase(light);
	const lightMixes = readMixes(light);
	const overrides = readBase(dark);
	const darkBase = { ...lightBase, ...overrides };
	const darkMixes = { ...lightMixes, ...readMixes(dark) };
	for (const key of Object.keys(overrides)) delete darkMixes[key];
	for (const key of Object.keys(darkMixes)) delete darkBase[key];
	return {
		base: { light: lightBase, dark: darkBase },
		mixes: { light: lightMixes, dark: darkMixes },
		rules: { light: readRules(light), dark: { ...readRules(light), ...readRules(dark) } },
		ladder: [...light.matchAll(LADDER)].map((m) => ({
			token: m[1],
			base: m[2],
			step: +m[3] as Step
		}))
	};
}

/** Color of a token in the mode: base tone or ramp step. */
export function colorOf(p: ParsedPalette, mode: Mode, token: string): Oklch {
	const direct = p.base[mode][token];
	if (direct) return direct;
	const mix = p.mixes[mode][token];
	if (mix) return mixOklab(colorOf(p, mode, mix.first), colorOf(p, mode, mix.second), mix.share);
	const entry = p.ladder.find((x) => x.token === token);
	if (!entry) throw new Error(`Unknown token: ${token}`);
	const rule = p.rules[mode][entry.step];
	if (!rule) throw new Error(`Step ${entry.step} missing in mode ${mode}`);
	return applyStep(colorOf(p, mode, entry.base), rule);
}

/** Ramp token of a family; step 4 is the base tone itself. */
export const stepToken = (base: string, step: Step) => (step === 4 ? base : `${base}-${step}`);
