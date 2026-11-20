import { contourApproach } from './ribbon-approach';
import { gradeRibbon } from './ribbon-grade';
import type { ribbonNetwork } from './ribbon-network';
import type { Vec3 } from '../parametrik/types';
type Ground = (x: number, y: number) => number;
/** Fits the requested route to terrain, water clearance and fixed terminals before graph measurement. */
export function fitApproaches(
	network: ReturnType<typeof ribbonNetwork>,
	ground: Ground,
	clear?: (a: Vec3, b: Vec3) => boolean,
	water?: Ground
) {
	const places = gradeRibbon(network, ground, water);
	if (!clear || !places.length) return;
	for (const { reach, side, base, top } of places) {
		const original = side ? reach.sections.toReversed() : reach.sections;
		const fit = contourApproach(original, base, top, ground, clear);
		if (fit === original) continue;
		reach.sections = side
			? fit.toReversed().map((s) => ({ ...s, left: s.right, right: s.left }))
			: fit;
	}
	gradeRibbon(network, ground, water);
}
