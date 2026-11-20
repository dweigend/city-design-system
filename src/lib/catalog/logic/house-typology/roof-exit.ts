import { partsIntersect } from './fit';
import { solid, worldSize } from './objects';
import { bandSolid } from './bands';
import type { Level, Plan } from './types';

/** Fits the crown exit between its bearings, the upper cabins and the surveyed parcel edge. */
export function roofExit(plan: Plan, level: Level, stations: number[], z: number) {
	const { site, rear, sign } = plan;
	const x = (stations[0] + stations[stations.length - 1]) / 2;
	const span = stations[stations.length - 1] - stations[0] + plan.bar;
	const plate = (width: number, depth: number, y: number) =>
		solid(
			site.id + '/roof-walk',
			'bearing',
			'deck',
			[x, y, z - 0.3],
			[width, depth, 0.3],
			site.ground,
			'deck'
		);
	const rest = plate(span, 0.3, rear - sign * 0.15);
	if (site.compact)
		return plate(Math.max(span, 2 * Math.abs(level.landing[0] - x) + 0.3), 0.3, rear - sign * 0.15);
	const limits = [site.center[1] - (site.depth - 2.5) / 2, site.center[1] + (site.depth - 2.5) / 2];
	const obstacles = level.bodies.map((b) =>
		bandSolid(
			solid(b.id, 'cantilever', 'body', b.position, worldSize(b), site.ground, b.use),
			b.band?.court
		)
	);
	for (const offset of [0.95, -1.25, 0]) {
		const y = Math.min(limits[1], Math.max(limits[0], rear + sign * offset));
		const walk = plate(Math.max(2.5, span), 2.5, y);
		if (!obstacles.some((b) => partsIntersect(walk, b))) return walk;
	}
	return rest;
}
