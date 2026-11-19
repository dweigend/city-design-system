import type { LinkKind } from '../district-frame';
import type { Vec3 } from '../parametrik/types';

import { clearRoute, type HouseObstacle } from './clearance';

/** Largest datum difference in metres that still reads as one level walking surface. */
const LEVEL = 0.3;
/** Longest clear span in metres without an intermediate pier. */
const SPAN = 14;

/** Surveys a level span between equal deck datums: straight first, then two symmetric doglegs
 * around intervening volumes. Unequal levels and overlong spans stay unconnected. */
export function bridgeRoute(
	from: Vec3,
	to: Vec3,
	adjacent: boolean,
	obstacles: HouseObstacle[],
	width: number
) {
	const rise = Math.abs(from[2] - to[2]);
	const dx = to[0] - from[0],
		dy = to[1] - from[1],
		run = Math.hypot(dx, dy);
	if (!Number.isFinite(run) || run < 0.01 || run > SPAN || rise > LEVEL) return;
	const level = (from[2] + to[2]) / 2;
	from = [from[0], from[1], level];
	to = [to[0], to[1], level];
	const kind: LinkKind = adjacent ? 'platform' : 'skyway';
	for (const offset of run > 4 * width ? [0, 0.45, -0.45] : [0]) {
		const mid: Vec3 = [
			(from[0] + to[0]) / 2 - dy * offset,
			(from[1] + to[1]) / 2 + dx * offset,
			(from[2] + to[2]) / 2
		];
		const route = offset ? [from, mid, to] : [from, to];
		if (clearRoute(route, obstacles, width)) return { from, to, rise, run, kind, route };
	}
}
