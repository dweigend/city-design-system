import type { Vec3 } from '../logic/parametrik/types';

/**
 * The transition world → three.js (PROCEDURAL_PRINCIPLES PE-2): world x/y ground plane with
 * z up, meters, becomes three (x, z, −y). A rotation; handedness is preserved.
 * Appends one world point to a flat three.js position array.
 */
export function pushThree(target: number[], [x, y, z]: Vec3) {
	target.push(x, z, -y);
}
