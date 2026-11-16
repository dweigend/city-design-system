/**
 * OKLCH math for the palette (headless). Source of the formulas: Björn Ottosson,
 * "A perceptual color space for image processing" (2020), matrices for sRGB/D65.
 * Contrast per WCAG 2.2 (relative luminance). Units: L and C without unit
 * (L 0–1), hue h in degrees as in CSS `oklch()`.
 */
export type Oklch = { l: number; c: number; h: number };
export type Rgb = [number, number, number];

/** Tolerance for "in the sRGB gamut": channel value in linear light. */
export const GAMUT_EPS = 1e-3;

/** OKLCH → linear sRGB (unclamped; values outside 0–1 mean outside the gamut). */
export function oklchToLinear({ l, c, h }: Oklch): Rgb {
	const rad = (h * Math.PI) / 180;
	const a = c * Math.cos(rad),
		b = c * Math.sin(rad);
	const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
	const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
	const s_ = l - 0.0894841775 * a - 1.291485548 * b;
	const L = l_ ** 3,
		M = m_ ** 3,
		S = s_ ** 3;
	return [
		4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
		-1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
		-0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S
	];
}

export const inGamut = (rgb: Rgb, eps = GAMUT_EPS) => rgb.every((v) => v >= -eps && v <= 1 + eps);

const encode = (v: number) => {
	const x = Math.min(1, Math.max(0, v));
	return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
};
const decode = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

/** Linear sRGB → #rrggbb (clamped). */
export function linearToHex(rgb: Rgb): string {
	return (
		'#' +
		rgb
			.map((v) =>
				Math.round(encode(v) * 255)
					.toString(16)
					.padStart(2, '0')
			)
			.join('')
	);
}

export function hexToLinear(hex: string): Rgb {
	const n = parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => decode(v / 255)) as Rgb;
}

/** Relative luminance per WCAG from linear sRGB. */
export const luminance = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Contrast ratio 1–21 per WCAG; order does not matter. */
export function contrast(a: Rgb, b: Rgb): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

/**
 * Step of a ramp, as in app.css: L moves by the share `k` from the base tone toward the target
 * `toward`, the chroma is scaled by `chroma`, the hue stays. Equivalent to
 * `oklch(from base calc(l + (toward - l) * k) calc(c * chroma) h)`.
 */
export type StepRule = { toward: number; k: number; chroma: number; maxChroma?: number };

export const applyStep = (base: Oklch, s: StepRule): Oklch => ({
	l: base.l + (s.toward - base.l) * s.k,
	c: Math.min(base.c * s.chroma, s.maxChroma ?? Infinity),
	h: base.h
});

/** Distance in OKLab space (ΔE_ok); visible from about 0.02, clear from 0.1. */
export function deltaE(a: Oklch, b: Oklch): number {
	const lab = ({ l, c, h }: Oklch) => [
		l,
		c * Math.cos((h * Math.PI) / 180),
		c * Math.sin((h * Math.PI) / 180)
	];
	const [x, y] = [lab(a), lab(b)];
	return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}
