import { cityCorridorPaths } from './city-corridors';
import { buildObject } from '../assets';
import { translate } from '../ansicht/geometrie';
import type { Vec3 } from '../parametrik/types';
import { walkwayParts } from '../walkway';
import { focuses, present, type FocusId } from '../presentation';
import type { World } from './world-contract';

/** Projects each landmark and its elevated station approach in world metres.
 * A lost footprint retires the landmark when the terrain is edited. */
export function cityCentreView(world: World, focus: FocusId = 'all') {
	const local = (world.state.city?.centres ?? []).flatMap(({ landmark, path, cellId }) => {
		const site = world.grid.cellsById.get(landmark.cellId);
		if (!site?.buildable) return [];
		const id = 'centre/' + cellId;
		const object = buildObject(landmark.object, landmark.variant, world.seed, { instanceId: id });
		const ground = path.flatMap((id) => world.grid.cellsById.get(id) ?? []);
		const deck = Math.max(...ground.map((c) => c.center[2])) + 2;
		const points = ground.map(({ center: [x, y, z] }, i): Vec3 => [
			x,
			y,
			i === 0 || i === ground.length - 1 ? z + 0.3 : deck
		]);
		return [
			...present(
				object.parts.map((part) => translate(part, site.center)),
				focuses[focus].houses
			),
			...present(
				walkwayParts(points, {
					id: id + '/path',
					groundZ: Math.min(...ground.map((c) => c.center[2])),
					simplifyAtCity: true
				}),
				focuses[focus].paths
			)
		];
	});
	return local.concat(present(cityCorridorPaths(world), focuses[focus].paths));
}
