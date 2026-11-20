import { tensionPatch } from '../membrane';
import type { SkinSolver } from '../house-structure';
import type { Vec3 } from '../parametrik/types';

type Grips = Parameters<typeof tensionPatch>[0];
/** Fabric of a skin that states none: unpressurised, tension in kN/m. */
const TAUT = { pressure: 0, tension: 2 };

/** The tension patch spans three or four grips; a larger or peaked loop is cut into gores. */
function panels(frame: Parameters<SkinSolver>[0]): Grips[] {
	const { boundary, interior, peak } = frame;
	if (!interior.length && boundary.length === 3) return [[boundary[0], boundary[1], boundary[2]]];
	if (!interior.length && boundary.length === 4)
		return [[boundary[0], boundary[1], boundary[2], boundary[3]]];
	return boundary.map((p, i): Grips => [p, boundary[(i + 1) % boundary.length], peak]);
}

/**
 * Tensions a skin over its grips with the shared membrane solver, in world metres. A loop of
 * three or four grips without interior grips is one patch; any other loop becomes one gore per
 * boundary edge up to the mean of its interior grips, or of its boundary without any. Uses the
 * patch's own fabric, or an unpressurised 2 kN/m. Throws RangeError on degenerate gores.
 */
export const tensionSkin: SkinSolver = (frame, patch) => {
	const points: Vec3[] = [],
		triangles: number[] = [];
	for (const grips of panels(frame)) {
		const solved = tensionPatch(grips, patch.membrane ?? TAUT);
		const base = points.length;
		points.push(...solved.positions);
		triangles.push(...solved.faces.map((i) => i + base));
	}
	return { points, triangles };
};
