import type { LinkKind } from '../district-frame';
import type { Vec3 } from '../parametrik/types';
import type { Deck } from './types';
import { clearRoute, type HouseObstacle } from './clearance';

function landing(deck: Deck, other: Deck): Vec3 {
	const [x, y, z] = deck.position,
		dx = other.position[0] - x,
		dy = other.position[1] - y;
	const u = dx / deck.width,
		v = dy / deck.depth;
	const t = 0.45 / (deck.round ? Math.hypot(u, v) : Math.max(Math.abs(u), Math.abs(v)));
	return [x + dx * t, y + dy * t, z];
}
/** Largest datum difference in metres that still reads as one level walking surface. */
const LEVEL = 0.3;
/** Longest clear span in metres without an intermediate pier. */
const SPAN = 12;

/** Surveys a level span between equal deck datums: straight first, then two symmetric doglegs
 * around intervening volumes. Unequal levels and overlong spans stay unconnected. */
export function bridgeRoute(
	left: Deck,
	right: Deck,
	adjacent: boolean,
	obstacles: HouseObstacle[],
	width: number
) {
	const from = landing(left, right),
		to = landing(right, left),
		rise = Math.abs(from[2] - to[2]);
	const dx = to[0] - from[0],
		dy = to[1] - from[1],
		run = Math.hypot(dx, dy);
	if (!Number.isFinite(run) || run < 0.01 || run > SPAN || rise > LEVEL) return;
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
