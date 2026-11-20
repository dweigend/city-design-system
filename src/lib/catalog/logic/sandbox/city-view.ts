import { privateSurface } from '../walkway-network';
import { cityCorridorPaths } from './city-corridors';
import { buildObject } from '../assets';
import { translate } from '../ansicht/geometrie';
import { focuses, present, type FocusId } from '../presentation';
import type { World } from './world-contract';

type Centre = NonNullable<World['state']['city']>['centres'][number];

/** Projects the installed landmark at a single town centre. */
export function centreLandmark(world: World, { landmark, cellId }: Centre, focus: FocusId = 'all') {
	const site = world.grid.cellsById.get(landmark.cellId);
	if (!site?.buildable) return [];
	const id = 'centre/' + cellId;
	const object = buildObject(landmark.object, landmark.variant, world.seed, { instanceId: id });
	return present(
		object.parts.map((part) => translate(privateSurface(part), site.center)),
		focuses[focus].houses
	);
}

/** Projects each landmark and the shared public deck tree in world metres. */
export function cityCentreView(world: World, focus: FocusId = 'all') {
	const local = (world.state.city?.centres ?? []).flatMap((centre) =>
		centreLandmark(world, centre, focus)
	);
	return local.concat(present(cityCorridorPaths(world), focuses[focus].paths));
}
