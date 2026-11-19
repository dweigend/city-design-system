import { routeDecks, spanSurvey } from '../walkway';
import type { Vec3 } from '../parametrik/types';
import type { HouseSurfaces } from './surfaces';
import { tread, pipeBetween } from './parts';

/** Seats registered plates and rails along the mitered bridge route at the surveyed walking datums. */
export function bridgeParts(route: Vec3[], id: string, width: number, surfaces: HouseSurfaces) {
	return routeDecks(route, width).flatMap((ring, i) => {
		const { treads, rails } = spanSurvey(ring, id + ':' + i, width, undefined, true);
		return [
			...treads.map(({ id, polygon, z, height, ...display }) => ({
				...tread(id, polygon, z + height - 0.3, 0.3, surfaces.access),
				...display
			})),
			...rails.map(({ id, points, ...display }) => ({
				...pipeBetween(id, points[0], points[1], 0.06, surfaces.frame),
				...display
			}))
		];
	});
}
