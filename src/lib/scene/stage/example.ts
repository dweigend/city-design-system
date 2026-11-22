import { bounds, houseExample } from '../../core/object';
import { defaultAssignment, resolveSurfaces } from '../surface';

export function stageExample() {
	const object = houseExample();
	const { wall, roof, glass } = defaultAssignment;
	return {
		drawables: resolveSurfaces(object, { wall, roof, glass }),
		footprint: object.footprint,
		bounds: bounds(object)
	};
}
