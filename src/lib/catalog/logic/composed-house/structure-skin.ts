import { tensionPatch } from '../membrane';
import type { SkinSolver } from '../house-structure';
import type { Vec3 } from '../parametrik/types';

type Grips = Parameters<typeof tensionPatch>[0];
/** Fabric of a skin that states none: unpressurised, tension in kN/m. */
const TAUT = { pressure: 0, tension: 2 };

type Panel = { grips: Grips; held: boolean[] };

/** The tension patch spans three or four grips; a larger or peaked loop is cut into gores. */
function panels(frame: Parameters<SkinSolver>[0]): Panel[] {
	const { boundary, interior, peak } = frame;
	const seams = frame.edges.map((edge) => edge === 'seam');
	if (!interior.length && boundary.length === 3)
		return [{ grips: [boundary[0], boundary[1], boundary[2]], held: seams }];
	if (!interior.length && boundary.length === 4)
		return [{ grips: [boundary[0], boundary[1], boundary[2], boundary[3]], held: seams }];
	return boundary.map((p, i) => ({
		grips: [p, boundary[(i + 1) % boundary.length], peak],
		held: [seams[i], true, true]
	}));
}

/**
 * Tensions a skin over its grips with the shared membrane solver, in world metres. A loop of
 * three or four grips without interior grips is one patch; any other loop becomes one gore per
 * boundary edge up to the mean of its interior grips, or of its boundary without any. Seams
 * stay straight between their grips; cable and free edges hang. Uses the patch's own fabric, or an unpressurised 2 kN/m. Throws RangeError on degenerate gores.
 */
export const tensionSkin: SkinSolver = (frame, patch) => {
	const points: Vec3[] = [],
		triangles: number[] = [];
	for (const { grips, held } of panels(frame)) {
		const solved = tensionPatch(grips, patch.membrane ?? TAUT, undefined, held);
		const base = points.length;
		points.push(...solved.positions);
		triangles.push(...solved.faces.map((i) => i + base));
	}
	return { points, triangles };
};
