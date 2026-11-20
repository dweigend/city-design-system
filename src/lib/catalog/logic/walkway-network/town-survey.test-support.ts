import { surveyedGrid } from '../sandbox/town-grid';
import { walkingHeight } from '../sandbox/network-terrain';
import type { Primitive } from '../parametrik/types';
import type { World } from '../sandbox';
import { cityCorridorSite } from '../sandbox/city-corridors';
import { surveyTownWalk } from './index';
import { convexParts } from '../parametrik/raster/geometry';

/** Recovers the untrimmed walking survey to check terminal attachment and routing budgets. */
export function surveyedWalk(world: World) {
	const site = cityCorridorSite(world);
	if (!site) throw Error('Missing town walk');
	const relief = surveyedGrid(world.grid);
	return surveyTownWalk(...site, (x, y) => walkingHeight(relief, x, y));
}
/** Reads the upper quads in the renderer's indexed sweep. */
export function ribbonQuads(parts: Primitive[]) {
	return parts.flatMap((p) =>
		p.kind !== 'mesh' || !p.id.startsWith('town-walk/') || !p.id.endsWith('/ramp')
			? []
			: Array.from({ length: p.points.length / 4 - 1 }, (_, i) => {
					const j = i * 4;
					return {
						id: p.id,
						points: [p.points[j + 2], p.points[j + 3], p.points[j + 7], p.points[j + 6]]
					};
				})
	);
}
/** Identifies projected upper walking faces independently of the palette. */
export function walkingPlates(parts: Primitive[]) {
	return parts
		.filter(
			(p): p is Extract<Primitive, { kind: 'prism' }> =>
				p.kind === 'prism' &&
				(p.id.startsWith('court/') ||
					(p.id.startsWith('town-walk/') && !/\/(life|planter|meeting)\//.test(p.id)))
		)
		.flatMap((p) => convexParts(p.polygon).map((polygon) => ({ ...p, polygon })));
}
