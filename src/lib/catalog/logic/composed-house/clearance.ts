import type { Vec3 } from '../parametrik/types';
import type { Section } from './types';

/** Conservative obstruction in metres with a bottom-centre origin. */
export type HouseObstacle = { position: Vec3; size: Vec3; owner?: string; cell?: string };
/** The swept span includes the deck width, slab thickness and guardrail above walking height. */
function crosses(a: Vec3, b: Vec3, box: HouseObstacle, margin: number) {
	let lo = 0,
		hi = 1;
	for (const k of [0, 1, 2] as const) {
		const min = box.position[k] - (k === 2 ? 1 : box.size[k] / 2 + margin);
		const max = box.position[k] + (k === 2 ? box.size[k] + 0.26 : box.size[k] / 2 + margin);
		const delta = b[k] - a[k];
		if (Math.abs(delta) < 1e-9) {
			if (a[k] < min || a[k] > max) return false;
			continue;
		}
		const t = (min - a[k]) / delta,
			u = (max - a[k]) / delta;
		lo = Math.max(lo, Math.min(t, u));
		hi = Math.min(hi, Math.max(t, u));
		if (lo > hi) return false;
	}
	return true;
}
/** Bounds the full frame and occupied decks when surveying another house’s span. */
export function sectionObstacle(s: Section): HouseObstacle {
	const extent = (axis: 0 | 1, span: 'width' | 'depth') =>
		Math.max(
			s[span],
			...s.decks.map((d) => 2 * Math.abs(d.position[axis] - s.base[axis]) + d[span])
		);
	return {
		owner: s.id,
		position: s.base,
		size: [
			extent(0, 'width'),
			extent(1, 'depth'),
			s.top - s.base[2] + (s.typology === 'tower' ? 4 : 0.5)
		]
	};
}
/** Checks every walking segment against the occupied volumes, accounting for its width. */
export function clearRoute(route: Vec3[], obstacles: HouseObstacle[], width: number) {
	return route
		.slice(1)
		.every((end, i) => obstacles.every((box) => !crosses(route[i], end, box, width / 2)));
}
