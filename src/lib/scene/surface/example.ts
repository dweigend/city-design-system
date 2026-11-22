import type { PlaceableObject } from '../../core/object';
import { defaultAssignment, resolveSurfaces, type Drawable } from './index';

// Pass in the fixed object from core/object/example.ts to run both examples together.
export function example(house: PlaceableObject): Drawable[] {
	const { plinth, wall, roof, glass, door } = defaultAssignment;
	return resolveSurfaces(house, { plinth, wall, roof, glass, door });
}
