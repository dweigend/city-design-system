import * as THREE from 'three/webgpu';
import type { Palette3D } from '../data/city3d';
import { flowToken } from '../data/focus';
import { tokenColor } from './material';

const neutral = (r: number, g: number, b: number) =>
	new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);

const paper = neutral(0.979, 0.969, 0.945);
const ink = neutral(0.23, 0.23, 0.22);
/** Resolve the semantic colors once. Paper and ink belong to the fixed studio scene. */
export function studioPalette(palette: Palette3D): Palette3D {
	return { ...palette, paper: '#' + paper.getHexString(), ink: '#' + ink.getHexString() };
}

/** Fixed paper and ink need no redraw. The remaining studio colors come from the flow contract. */
export function studioFarbwechsel(vorher: Palette3D | undefined, jetzt: Palette3D): boolean {
	if (!vorher) return true;
	return Object.values(flowToken).some(
		(token) => !tokenColor(vorher, token).equals(tokenColor(jetzt, token))
	);
}
