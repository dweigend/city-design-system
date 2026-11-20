import { privateSurface } from '../walkway-network';
import { cityCorridorPaths } from './city-corridors';
import { buildObject } from '../assets';
import { translate } from '../ansicht/geometrie';
import { focuses, present, type FocusId } from '../presentation';
import type { World } from './world-contract';

/** Projects each landmark and the shared public deck tree in world metres.
 * A lost footprint retires the landmark when the terrain is edited. */
export function cityCentreView(world: World, focus: FocusId = 'all') {
	const local = (world.state.city?.centres ?? []).flatMap(({ landmark, cellId }) => {
		const site = world.grid.cellsById.get(landmark.cellId);
		if (!site?.buildable) return [];
		const id = 'centre/' + cellId;
		const object = buildObject(landmark.object, landmark.variant, world.seed, { instanceId: id });
		return present(
			object.parts.map((part) => translate(privateSurface(part), site.center)),
			focuses[focus].houses
		);
	});
	return local.concat(present(cityCorridorPaths(world), focuses[focus].paths));
}
