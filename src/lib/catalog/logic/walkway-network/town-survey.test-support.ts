import { spanSurvey, deckCorners } from '../walkway';
import type { Primitive } from '../parametrik/types';
import type { World } from '../sandbox';
import { cityCorridorSite } from '../sandbox/city-corridors';
import { surveyTownWalk } from './index';
import { convexParts } from '../parametrik/raster/geometry';

/** Recovers the untrimmed walking survey to check terminal attachment and routing budgets. */
export function surveyedFloors(world: World) {
	const site = cityCorridorSite(world);
	if (!site) return [];
	const [routes, center, courts, , seed] = site;
	return surveyTownWalk(routes, center, courts, seed).spans.flatMap(({ id, a, b }) =>
		spanSurvey(deckCorners(a, b, 2.5), id, 2.5, { thickness: 0.2, treadRise: 0.17 }).treads.map(
			(t) => ({
				...t,
				kind: 'prism' as const,
				token: '--paper' as const,
				role: 'neu' as const,
				material: 'concrete' as const
			})
		)
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
