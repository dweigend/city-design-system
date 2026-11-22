import { bounds, houseExample } from '../../core/object';
import { defaultAssignment, resolveSurfaces } from '../surface';

export function stageExample() {
	const object = houseExample();
	const { plinth, wall, roof, glass, door } = defaultAssignment;
	return {
		drawables: resolveSurfaces(object, { plinth, wall, roof, glass, door }),
		footprint: object.footprint,
		bounds: bounds(object)
	};
}
