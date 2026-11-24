import { bounds, houseExample } from '../../core/object';
import { accent, existing, resolveSurfaces } from '../surface';

export function stageExample() {
	const object = houseExample();
	return {
		drawables: resolveSurfaces(object, existing),
		newDrawables: resolveSurfaces(object, accent('--cat-living')),
		footprint: object.footprint,
		bounds: bounds(object)
	};
}
