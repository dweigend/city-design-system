import { Color, LinearSRGBColorSpace } from 'three';
import { oklchToLinear } from '../../logic/farbe/oklch';

/** Converts a neutral tone from OKLCH lightness into a renderer color. */
export function neutral(l: number): Color {
	return new Color().setRGB(...oklchToLinear({ l, c: 0, h: 0 }), LinearSRGBColorSpace);
}
