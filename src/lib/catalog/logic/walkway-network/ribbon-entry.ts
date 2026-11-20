import { walkingProfile } from './walking-profile';
import type { Primitive } from '../parametrik/types';
import { ribbonCurve } from './ribbon-curve';
import { ribbonDeck } from './ribbon-deck';
import type { TownSpan } from './town-stations';
/** Joins the approach, certified interior and egress at the surveyed sill positions. */
export function ribbonEntry(
	route: TownSpan[],
	ground: (x: number, y: number) => number,
	courts: Primitive[]
) {
	const first = route.findIndex((s) => s.inside),
		last = route.findLastIndex((s) => s.inside);
	return [route.slice(0, first), route.slice(first, last + 1), route.slice(last + 1)].flatMap(
		(spans) => {
			if (!spans.length) return [];
			const points = [spans[0].a, ...spans.map((s) => s.b)];
			const id = spans[spans.length - 1].id;
			return ribbonDeck(
				{
					forks: [],
					reaches: [
						{
							id,
							ends: [points[0], points[points.length - 1]],
							hubs: [],
							sections: ribbonCurve(points, walkingProfile.width)
						}
					]
				},
				ground,
				courts,
				{ inside: spans[0].inside, railId: id + '/rail' }
			);
		}
	);
}
