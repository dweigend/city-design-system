import { required } from '../required';
import { STORY } from '../../data/grid';
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
function levelReturn(route: Vec3[]) {
	// Keep the skyway level across the gap, with a short flight at the lower end.
	const points = route.map((p): Vec3 => [...p]),
		reverse = points[0][2] > required(points.at(-1), 'bridge endpoint')[2];
	if (reverse) points.reverse();
	const [a, b] = points,
		top = required(points.at(-1), 'bridge endpoint')[2];
	for (const point of points.slice(1)) point[2] = top;
	points.splice(1, 0, [a[0] + (b[0] - a[0]) * 0.33, a[1] + (b[1] - a[1]) * 0.33, top]);
	return reverse ? points.reverse() : points;
}
/** Surveys the straight span first, then two symmetric doglegs around intervening volumes. */
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
	if (!Number.isFinite(run) || run < 0.01) return;
	const kind: LinkKind = adjacent ? 'platform' : rise <= STORY ? 'skyway' : 'stair-bridge';
	for (const offset of run > 4 * width ? [0, 0.45, -0.45] : [0]) {
		const mid: Vec3 = [
			(from[0] + to[0]) / 2 - dy * offset,
			(from[1] + to[1]) / 2 + dx * offset,
			(from[2] + to[2]) / 2
		];
		const span = offset ? [from, mid, to] : [from, to];
		const route = kind === 'skyway' && rise > 0.01 ? levelReturn(span) : span;
		if (clearRoute(route, obstacles, width)) return { from, to, rise, kind, route };
	}
}
