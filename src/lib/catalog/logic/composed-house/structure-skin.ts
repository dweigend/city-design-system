import { tensionPatch } from '../membrane';
import { skinPanels, type SkinSolver } from '../house-structure';
import type { Vec3 } from '../parametrik/types';

/** Fabric of a skin that states none: unpressurised, tension in kN/m. */
const TAUT = { pressure: 0, tension: 2 };

/**
 * Tensions a skin over its grips with the shared membrane solver, in world metres. A loop of
 * three or four grips without interior grips is one patch; any other loop becomes one gore per
 * boundary edge up to the mean of its interior grips, or of its boundary without any. Seams
 * stay straight between their grips; cable and free edges hang. Uses the patch's own fabric, or an unpressurised 2 kN/m. Throws RangeError on degenerate gores.
 */
export const tensionSkin: SkinSolver = (frame, patch) => {
	const points: Vec3[] = [],
		triangles: number[] = [];
	for (const { grips, held } of skinPanels(frame)) {
		const solved = tensionPatch(grips, patch.membrane ?? TAUT, undefined, held);
		const base = points.length;
		points.push(...solved.positions);
		triangles.push(...solved.faces.map((i) => i + base));
	}
	return { points, triangles };
};
