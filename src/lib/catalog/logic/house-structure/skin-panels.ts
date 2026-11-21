import type { Vec3 } from '../parametrik/types';
import type { SkinFrame } from './graph';
type Grips = [Vec3, Vec3, Vec3] | [Vec3, Vec3, Vec3, Vec3];
type Panel = { grips: Grips; held: boolean[] };

/** The tension patch spans three or four grips; a larger or peaked loop is cut into gores. */
export function skinPanels(frame: SkinFrame): Panel[] {
	const { boundary, interior, peak } = frame;
	const seams = frame.edges.map((edge) => edge === 'seam');
	if (frame.batten) {
		const [a, b, c, d] = boundary,
			[left, right] = frame.batten;
		return [
			{ grips: [a, b, right, left], held: [seams[0], seams[1], true, seams[3]] },
			{ grips: [left, right, c, d], held: [true, seams[1], seams[2], seams[3]] }
		];
	}
	if (!interior.length && boundary.length === 3)
		return [{ grips: [boundary[0], boundary[1], boundary[2]], held: seams }];
	if (!interior.length && boundary.length === 4)
		return [{ grips: [boundary[0], boundary[1], boundary[2], boundary[3]], held: seams }];
	return boundary.map((p, i) => ({
		grips: [p, boundary[(i + 1) % boundary.length], peak],
		held: [seams[i], true, true]
	}));
}
