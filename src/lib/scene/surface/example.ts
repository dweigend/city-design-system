import type { PlaceableObject } from '../../core/object';
import { existing, resolveSurfaces, type Drawable } from './index';

// Pass in the fixed object from core/object/example.ts to run both examples together.
export function example(house: PlaceableObject): Drawable[] {
	return resolveSurfaces(house, existing);
}
