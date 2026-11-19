import { linearToOklch, oklchToLinear, type Rgb } from './oklch';

/** The path ramp is reserved for opaque pink marks. */
export function isPathInk(token: string): boolean {
	return token === '--cat-business' || token.startsWith('--cat-business-');
}

const MIN_LIGHTNESS = 0.42;

function multiply(a: number, b: number, paper: number): number {
	const product = a * b;
	return paper > 0 ? Math.min(1, product / paper) : Number(product > 0);
}

/**
 * Detached linear sRGB pigment for two opaque inks on the given paper. Inputs are resolved
 * linear sRGB channels in [0, 1]. Returns undefined when either ink is from the path ramp.
 * Floors OKLCH lightness at 0.42 and reduces chroma only if needed to fit sRGB.
 */
export function overprintColor(
	first: { token: string; rgb: Rgb },
	second: { token: string; rgb: Rgb },
	paper: Rgb
): Rgb | undefined {
	if (isPathInk(first.token) || isPathInk(second.token)) return;
	const product = first.rgb.map((value, i) => multiply(value, second.rgb[i], paper[i])) as Rgb;
	const tone = linearToOklch(product);
	if (tone.l >= MIN_LIGHTNESS) return product;
	tone.l = MIN_LIGHTNESS;
	let result = oklchToLinear(tone);
	while (result.some((v) => v < 0 || v > 1)) {
		tone.c *= 0.9;
		result = oklchToLinear(tone);
	}
	return result;
}
