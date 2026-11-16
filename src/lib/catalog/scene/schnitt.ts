import type { Node } from 'three/webgpu';
import { Color } from 'three/webgpu';
import { color, mix } from 'three/tsl';
import type { Role } from '../logic/parametrik/types';
import { linien, strich } from './schraffur';

/** Hatch spacing in meters (existing stock in section). */
const PITCH = 0.42;

/**
 * Poché of the cut faces (40): new additions as an ink fill with fine paper hatching,
 * existing stock hatched gray on paper. Hatching on the drawing sheet (schraffur.ts):
 * same spacing and same direction on every section plane.
 */
export function pocheColor(role: Role, paper: Color, ink: Color, grey: Color): Node<'vec3'> {
	const v = linien(45, PITCH);
	if (role === 'bestand') return mix(color(paper), color(grey), strich(v, 0.14).mul(0.9));
	// New: nearly full ink; a hairline of paper keeps the fill legible like an ink wash.
	return mix(color(ink), color(paper), strich(v, 0.06).mul(0.35));
}
