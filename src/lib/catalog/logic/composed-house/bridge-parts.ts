import { routeDecks, spanSurvey } from '../walkway';
import type { Vec3 } from '../parametrik/types';
import { roleSurface, type HouseSurfaces } from './surfaces';
import { tread, pipeBetween } from './parts';

function endSteps(route: Vec3[], thresholds: readonly [number, number]) {
	const transition = ([x, y, z]: Vec3, neighbor: Vec3): Vec3 => {
		const dx = neighbor[0] - x,
			dy = neighbor[1] - y;
		const run = Math.hypot(dx, dy);
		const reach = Math.min(run / 4, 0.6);
		return [x + (dx * reach) / run, y + (dy * reach) / run, z];
	};
	const path = [...route];
	const last = route.length - 1;
	if (thresholds[1] !== route[last][2]) {
		path[last] = [route[last][0], route[last][1], thresholds[1]];
		path.splice(last, 0, transition(route[last], route[last - 1]));
	}
	if (thresholds[0] !== route[0][2]) {
		path[0] = [route[0][0], route[0][1], thresholds[0]];
		path.splice(1, 0, transition(route[0], route[1]));
	}
	return path;
}
/** Seats registered plates and rails along the mitered bridge route at the surveyed walking datums. */
export function bridgeParts(
	route: Vec3[],
	id: string,
	width: number,
	surfaces: HouseSurfaces,
	thresholds: readonly [number, number]
) {
	const path = endSteps(route, thresholds);
	return routeDecks(path, width).flatMap((ring, i) => {
		const { treads, rails } = spanSurvey(ring, id + ':' + i, width, undefined, true);
		return [
			...treads.map(({ id, polygon, z, height, ...display }) => ({
				...tread(id, polygon, z + height - 0.24, 0.24, roleSurface(surfaces.access, 'deck')),
				...display
			})),
			...rails.flatMap(({ id, points }) => handrail(id, points, surfaces))
		];
	});
}

function handrail(id: string, points: [Vec3, Vec3], surfaces: HouseSurfaces) {
	const at = (t: number, h: number): Vec3 =>
		points[0].map((v, k) => v + (points[1][k] - v) * t + (k === 2 ? h - 1 : 0)) as Vec3;
	const metal = roleSurface(surfaces.frame, 'screen');
	const n = Math.max(
		1,
		Math.ceil(Math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1]) / 2.5)
	);
	return [
		pipeBetween(id, at(0, 1.1), at(1, 1.1), 0.06, metal),
		...Array.from({ length: n + 1 }, (_, i) =>
			pipeBetween(id + '/post/' + i, at(i / n, 0), at(i / n, 1.1), 0.06, metal)
		)
	];
}
